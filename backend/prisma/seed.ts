import dotenv from 'dotenv';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

dotenv.config({ path: process.env.ENV_FILE || '.env' });
dotenv.config({ path: process.env.ENV_FILE || '../.env' });
const db=new PrismaClient();
async function main(){
	const email=process.env.SEED_ADMIN_EMAIL;
	const password=process.env.SEED_ADMIN_PASSWORD;
	if(!email||!password)throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create an administrator.');
	const passwordHash=await bcrypt.hash(password,12);
	await db.user.upsert({where:{email},update:{},create:{email,passwordHash,role:Role.ADMIN,emailVerified:true}});
}
main().finally(()=>db.$disconnect());
