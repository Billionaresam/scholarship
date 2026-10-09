import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomInt } from 'node:crypto';
import nodemailer from 'nodemailer';
import { PrismaClient, Role, ApplicationStatus } from '@prisma/client';
import { z } from 'zod';
import { searchIpedsDirectory } from './services/ipedsDirectory.js';

dotenv.config({ path: process.env.ENV_FILE || '.env' });
dotenv.config({ path: process.env.ENV_FILE || '../.env' });
const db=new PrismaClient(), app=express(), port=Number(process.env.PORT||4000), secret=process.env.JWT_SECRET||'dev-only-change-me';
app.set('trust proxy', 1);
if (process.env.NODE_ENV === 'production' && secret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters in production.');
app.use(helmet()); app.use(cors({origin:process.env.WEB_ORIGIN||'http://localhost:5173'})); app.use(express.json({limit:'1mb'})); app.use(rateLimit({windowMs:15*60*1000,max:200}));
app.use('/api', (_req, res, next) => {
	res.set('Cache-Control', 'no-store');
	next();
});
const token=(u:any)=>jwt.sign({sub:u.id,role:u.role},secret,{expiresIn:'8h'});
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const contactLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });
const hashVerificationToken = (value: string) => createHash('sha256').update(value).digest('hex');
const sendVerificationEmail = async (email: string, verificationCode: string) => {
	const host = process.env.SMTP_HOST;
	const from = process.env.EMAIL_FROM;
	if (!host || !from) throw new Error('Email delivery is not configured. Set SMTP_HOST and EMAIL_FROM.');
	const transport = nodemailer.createTransport({
		host,
		port: Number(process.env.SMTP_PORT || 587),
		secure: process.env.SMTP_SECURE === 'true',
		...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || '' } } : {}),
	});
	await transport.sendMail({
		from,
		to: email,
		subject: 'Verify your ScholarBridge email',
		text: `Your ScholarBridge verification code is ${verificationCode}. It expires in 15 minutes.`,
		html: `<p>Your ScholarBridge verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${verificationCode}</p><p>It expires in 15 minutes. If you did not create this account, you can ignore this email.</p>`,
	});
};
const sendContactMessage = async (message: { name: string; email: string; subject: string; message: string }) => {
	const host = process.env.SMTP_HOST;
	const from = process.env.EMAIL_FROM;
	const recipient = process.env.CONTACT_EMAIL;
	if (!host || !from || !recipient) throw new Error('Contact email delivery is not configured.');
	const transport = nodemailer.createTransport({
		host,
		port: Number(process.env.SMTP_PORT || 587),
		secure: process.env.SMTP_SECURE === 'true',
		...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || '' } } : {}),
	});
	await transport.sendMail({
		from,
		to: recipient,
		replyTo: message.email,
		subject: `ScholarBridge contact: ${message.subject}`,
		text: `From: ${message.name} <${message.email}>\n\n${message.message}`,
	});
};
const createVerificationToken = async (userId: string, email: string) => {
	const verificationCode = randomInt(100000, 1000000).toString();
	await db.emailVerificationToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
	await db.emailVerificationToken.create({ data: { userId, tokenHash: hashVerificationToken(verificationCode), expiresAt: new Date(Date.now() + 15 * 60 * 1000) } });
	await sendVerificationEmail(email, verificationCode);
};
const auth=(roles?:Role[])=>async(req:any,res:any,next:any)=>{try{const h=req.headers.authorization;if(!h?.startsWith('Bearer '))return res.status(401).json({error:'Authentication required'});const p=jwt.verify(h.slice(7),secret) as any;if(roles&&!roles.includes(p.role))return res.status(403).json({error:'Insufficient permissions'});req.user=p;next()}catch{return res.status(401).json({error:'Invalid or expired token'})}};
app.get('/health',async(_,res)=>{try{await db.$queryRaw`SELECT 1`;res.json({ok:true,service:'scholarbridge-api',database:'connected'})}catch{res.status(503).json({ok:false,service:'scholarbridge-api',database:'unavailable'})}});
app.post('/api/contact', contactLimiter, async (req, res) => {
	const parsed = z.object({
		name: z.string().trim().min(1).max(80),
		email: z.string().trim().email().max(254),
		subject: z.string().trim().min(3).max(120).refine((value) => !/[\r\n]/.test(value)),
		message: z.string().trim().min(10).max(4000),
		website: z.string().max(0).optional(),
	}).safeParse(req.body);
	if (!parsed.success) return res.status(400).json({ error: 'Check your name, email, subject, and message, then try again.' });
	if (parsed.data.website) return res.status(202).json({ message: 'Message received.' });
	try {
		await sendContactMessage(parsed.data);
		res.status(202).json({ message: 'Message sent.' });
	} catch (error) {
		console.error('Contact message could not be delivered:', error);
		res.status(503).json({ error: 'Contact email is temporarily unavailable. Please try again later.' });
	}
});
app.get('/api/universities', async (req, res) => {
	const parsed = z.object({
		q: z.string().trim().max(100),
		state: z.string().refine((value) => !value || /^[A-Z]{2}$/.test(value)),
		ownership: z.enum(['', 'Public', 'Private nonprofit', 'Private for-profit']),
		degreeGranting: z.enum(['', '1', '0']),
		page: z.coerce.number().int().min(0).max(999),
		pageSize: z.coerce.number().int().min(1).max(100),
	}).safeParse({
		q: typeof req.query.q === 'string' ? req.query.q : '',
		state: typeof req.query.state === 'string' ? req.query.state : '',
		ownership: typeof req.query.ownership === 'string' ? req.query.ownership : '',
		degreeGranting: typeof req.query.degreeGranting === 'string' ? req.query.degreeGranting : '',
		page: req.query.page ?? 0,
		pageSize: req.query.pageSize ?? 24,
	});

	if (!parsed.success) return res.status(400).json({ error: 'Invalid university search filters' });

	try {
		const results = await searchIpedsDirectory({ ...parsed.data, query: parsed.data.q });
		res.set('Cache-Control', 'public, max-age=3600').json(results);
	} catch {
		console.error('IPEDS university directory could not be loaded.');
		res.status(500).json({ error: 'The university directory could not be loaded. Regenerate its IPEDS data file and try again.' });
	}
});
app.post('/api/auth/register',authLimiter,async(req,res)=>{const s=z.object({email:z.string().email(),password:z.string().min(8),firstName:z.string().trim().min(1).max(80),lastName:z.string().trim().min(1).max(80)}).safeParse(req.body);if(!s.success)return res.status(400).json({error:'Enter a valid email, password of at least 8 characters, and your name.'});const {email,password,firstName,lastName}=s.data;const existing=await db.user.findUnique({where:{email}});if(existing)return res.status(409).json({error:existing.emailVerified?'Email already registered':'An account exists for this email. Resend the verification email.'});const u=await db.user.create({data:{email,passwordHash:await bcrypt.hash(password,12),student:{create:{firstName,lastName}}},include:{student:true}});try{await createVerificationToken(u.id,u.email)}catch(error){console.error('Verification email could not be delivered:',error);return res.status(503).json({error:'Your account was created, but verification email delivery is temporarily unavailable. Try resending the email.'})}res.status(201).json({message:'Account created. Check your email for a verification code.',emailVerificationRequired:true,email:u.email})});
app.post('/api/auth/login',authLimiter,async(req,res)=>{const s=z.object({email:z.string().email(),password:z.string()}).safeParse(req.body);if(!s.success)return res.status(400).json({error:'Invalid credentials'});const u=await db.user.findUnique({where:{email:s.data.email},include:{student:true}});if(!u||!(await bcrypt.compare(s.data.password,u.passwordHash)))return res.status(401).json({error:'Invalid credentials'});if(!u.emailVerified)return res.status(403).json({error:'Email verification required. Check your email or request a new code.'});res.json({token:token(u),user:{id:u.id,email:u.email,role:u.role,student:u.student}})});
app.post('/api/auth/resend-verification',authLimiter,async(req,res)=>{const s=z.object({email:z.string().email()}).safeParse(req.body);if(!s.success)return res.status(400).json({error:'Valid email required'});const u=await db.user.findUnique({where:{email:s.data.email}});if(u&&!u.emailVerified){try{await createVerificationToken(u.id,u.email)}catch(error){console.error('Verification email could not be delivered:',error);return res.status(503).json({error:'Email delivery is temporarily unavailable. Try again later.'})}}res.json({message:'If your account needs verification, a new code has been sent.'})});
app.post('/api/auth/verify-email',authLimiter,async(req,res)=>{const s=z.object({email:z.string().email(),token:z.string().regex(/^\d{6}$/)}).safeParse(req.body);if(!s.success)return res.status(400).json({error:'Enter the six-digit code sent to your email.'});const u=await db.user.findUnique({where:{email:s.data.email}});if(!u)return res.status(400).json({error:'Invalid or expired verification code.'});const now=new Date();const record=await db.emailVerificationToken.findFirst({where:{userId:u.id,tokenHash:hashVerificationToken(s.data.token),usedAt:null,expiresAt:{gt:now}}});if(!record)return res.status(400).json({error:'Invalid or expired verification code.'});await db.$transaction([db.user.update({where:{id:u.id},data:{emailVerified:true}}),db.emailVerificationToken.update({where:{id:record.id},data:{usedAt:now}})]);res.json({message:'Email verified successfully.'})});
app.get('/api/me',auth(),async(req:any,res)=>res.json(await db.user.findUnique({where:{id:req.user.sub},include:{student:true}})));
app.get('/api/scholarships', async (req, res) => {
	const q = String(req.query.q || '');
	const degree = String(req.query.degree || '');
	const funding = String(req.query.funding || '');
	const rows = await db.scholarship.findMany({
		where: {
			verificationStatus: { in: ['VERIFIED', 'NEEDS_REVIEW'] },
			...(degree ? { degreeLevel: degree } : {}),
			...(funding ? { fundingType: funding as any } : {}),
			...(q ? { OR: [
				{ title: { contains: q, mode: 'insensitive' } },
				{ field: { contains: q, mode: 'insensitive' } },
				{ provider: { contains: q, mode: 'insensitive' } },
			] } : {}),
		},
		orderBy: { deadline: 'asc' },
	});
	res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60').json(rows);
});
app.get('/api/scholarships/:id', async (req, res) => {
	const row = await db.scholarship.findUnique({ where: { id: req.params.id }, include: { university: true, program: true } });
	if (!row) return res.status(404).json({ error: 'Not found' });
	res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60').json(row);
});
app.put('/api/students/me',auth([Role.STUDENT]),async(req:any,res)=>{const s=z.object({firstName:z.string().min(1),lastName:z.string().min(1),country:z.string().optional(),citizenship:z.string().optional(),degreeLevel:z.string().optional(),field:z.string().optional(),gpa:z.number().min(0).max(4).optional(),targetIntake:z.string().optional(),fundingNeed:z.string().optional()}).safeParse(req.body);if(!s.success)return res.status(400).json({error:'Invalid profile'});const st=await db.student.update({where:{userId:req.user.sub},data:{...s.data,profileComplete:Math.min(100,Object.values(s.data).filter(v=>v!==undefined&&v!=='').length*12)}});res.json(st)});
app.post('/api/applications',auth([Role.STUDENT]),async(req:any,res)=>{const s=z.object({scholarshipId:z.string()}).safeParse(req.body);if(!s.success)return res.status(400).json({error:'scholarshipId required'});const st=await db.student.findUnique({where:{userId:req.user.sub}});if(!st)return res.status(400).json({error:'Student profile missing'});try{const a=await db.application.create({data:{studentId:st.id,scholarshipId:s.data.scholarshipId}});res.status(201).json(a)}catch{res.status(409).json({error:'Application already exists'})}});
app.get('/api/applications/me',auth([Role.STUDENT]),async(req:any,res)=>{const st=await db.student.findUnique({where:{userId:req.user.sub}});res.json(st?await db.application.findMany({where:{studentId:st.id},include:{scholarship:true},orderBy:{id:'desc'}}):[])});
app.post('/api/applications/:id/submit',auth([Role.STUDENT]),async(req:any,res)=>{const st=await db.student.findUnique({where:{userId:req.user.sub}});const a=await db.application.findFirst({where:{id:req.params.id,studentId:st?.id}});if(!a)return res.status(404).json({error:'Application not found'});const out=await db.application.update({where:{id:a.id},data:{status:ApplicationStatus.SUBMITTED,submittedAt:new Date()}});res.json(out)});
app.get('/api/admin/applications',auth([Role.ADMIN,Role.REVIEWER]),async(_,res)=>res.json(await db.application.findMany({include:{student:true,scholarship:true,reviews:true},orderBy:{submittedAt:'desc'}})));
app.patch('/api/admin/applications/:id',auth([Role.ADMIN,Role.REVIEWER]),async(req:any,res)=>{const s=z.object({status:z.nativeEnum(ApplicationStatus),notes:z.string().optional()}).safeParse(req.body);if(!s.success)return res.status(400).json({error:'Invalid status'});const out=await db.application.update({where:{id:req.params.id},data:s.data});await db.auditLog.create({data:{actorId:req.user.sub,action:'APPLICATION_STATUS_CHANGED',entityType:'Application',entityId:out.id,metadata:{status:s.data.status}}});res.json(out)});
app.get('/api/admin/audit',auth([Role.ADMIN]),async(_,res)=>res.json(await db.auditLog.findMany({orderBy:{createdAt:'desc'},take:200,include:{actor:{select:{email:true}}}})));
app.use((err:any,_req:any,res:any,_next:any)=>{
	if (err?.name === 'PrismaClientInitializationError' || err?.code === 'P1001') {
		console.warn('Database is temporarily unavailable.');
		return res.status(503).json({error:'The database is temporarily unavailable.'});
	}
	console.error(err);
	res.status(500).json({error:'Internal server error'});
});
app.listen(port,()=>console.log(`ScholarBridge API on :${port}`));
