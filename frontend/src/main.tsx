import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { api } from "./lib/api";

type Scholarship = {
  id: string;
  title: string;
  description: string;
  provider: string;
  degreeLevel: string;
  field: string;
  fundingType: "FULL" | "PARTIAL";
  amountText: string;
  deadline?: string;
  verificationStatus: string;
  sourceUrl?: string | null;
};

type Application = {
  id: string;
  scholarshipId: string;
  status: string;
  createdAt: string;
};
type University = {
  id: number;
  name: string;
  city: string;
  state: string;
  zip: string;
  website: string | null;
  applicationUrl: string | null;
  financialAidUrl: string | null;
  ownership: string;
  level: string;
  degreeGranting: boolean;
};
type UniversityResults = {
  sourceYear: number;
  sourceUrl: string;
  total: number;
  page: number;
  pageSize: number;
  results: University[];
};
type StudentProfile = {
  country: string;
  citizenship: string;
  degreeLevel: string;
  field: string;
  gpa: string;
  targetIntake: string;
  fundingNeed: string;
};
type View = "discover" | "universities" | "saved" | "applications" | "profile";

const emptyProfile: StudentProfile = {
  country: "",
  citizenship: "",
  degreeLevel: "",
  field: "",
  gpa: "",
  targetIntake: "",
  fundingNeed: "",
};

const usStates = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["DC", "District of Columbia"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
  ["AS", "American Samoa"],
  ["FM", "Federated States of Micronesia"],
  ["GU", "Guam"],
  ["MH", "Marshall Islands"],
  ["MP", "Northern Mariana Islands"],
  ["PW", "Palau"],
  ["PR", "Puerto Rico"],
  ["VI", "U.S. Virgin Islands"],
] as const;

const readStorage = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};

function App() {
  const [view, setView] = useState<View>("discover");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuButton = useRef<HTMLButtonElement>(null);
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [saved, setSaved] = useState<string[]>(() =>
    readStorage("sb_saved", []),
  );
  const [savedUniversities, setSavedUniversities] = useState<University[]>(() =>
    readStorage("sb_saved_universities", []),
  );
  const [profile, setProfile] = useState<StudentProfile>(emptyProfile);
  const [profileStatus, setProfileStatus] = useState("");
  const [query, setQuery] = useState("");
  const [degree, setDegree] = useState("All degrees");
  const [funding, setFunding] = useState("Any award");
  const [selected, setSelected] = useState<Scholarship | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "create" | "verify">(
    "signin",
  );
  const [authError, setAuthError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [verificationPending, setVerificationPending] = useState(false);
  const [session, setSession] = useState(() =>
    localStorage.getItem("sb_token") ? "account" : "",
  );
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [universities, setUniversities] = useState<University[]>([]);
  const [universityInput, setUniversityInput] = useState("");
  const [universityQuery, setUniversityQuery] = useState("");
  const [universityState, setUniversityState] = useState("");
  const [universityOwnership, setUniversityOwnership] = useState("");
  const [universityDegreeGranting, setUniversityDegreeGranting] = useState("1");
  const [universityPage, setUniversityPage] = useState(0);
  const [universityTotal, setUniversityTotal] = useState(0);
  const [directoryYear, setDirectoryYear] = useState(2024);
  const [directorySourceUrl, setDirectorySourceUrl] = useState(
    "https://nces.ed.gov/ipeds/",
  );
  const [universityLoading, setUniversityLoading] = useState(false);
  const [universityError, setUniversityError] = useState("");
  const [scholarshipError, setScholarshipError] = useState("");

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        mobileMenuButton.current?.focus();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    let active = true;
    api<Scholarship[]>("/scholarships")
      .then((items) => {
        if (active) setScholarships(items);
      })
      .catch((error) => {
        if (active)
          setScholarshipError(
            error instanceof Error
              ? error.message
              : "Scholarships are temporarily unavailable.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("sb_saved", JSON.stringify(saved));
  }, [saved]);
  useEffect(() => {
    localStorage.setItem(
      "sb_saved_universities",
      JSON.stringify(savedUniversities),
    );
  }, [savedUniversities]);
  useEffect(() => {
    if (!localStorage.getItem("sb_token")) return;
    api<
      Array<{
        id: string;
        scholarshipId: string;
        status: string;
        submittedAt: string | null;
      }>
    >("/applications/me")
      .then((items) =>
        setApplications(
          items.map((item) => ({
            ...item,
            createdAt: item.submittedAt || new Date().toISOString(),
          })),
        ),
      )
      .catch(() => {});
    api<{
      email: string;
      student?: {
        firstName: string;
        lastName: string;
        country: string | null;
        citizenship: string | null;
        degreeLevel: string | null;
        field: string | null;
        gpa: number | null;
        targetIntake: string | null;
        fundingNeed: string | null;
      };
    }>("/me")
      .then((user) => {
        setEmail(user.email);
        if (!user.student) return;
        localStorage.setItem("sb_first_name", user.student.firstName);
        localStorage.setItem("sb_last_name", user.student.lastName);
        setSession(user.student.firstName);
        setProfile({
          country: user.student.country || "",
          citizenship: user.student.citizenship || "",
          degreeLevel: user.student.degreeLevel || "",
          field: user.student.field || "",
          gpa: user.student.gpa?.toString() || "",
          targetIntake: user.student.targetIntake || "",
          fundingNeed: user.student.fundingNeed || "",
        });
      })
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    if (view !== "universities") return;
    let active = true;
    const timer = window.setTimeout(() => {
      setUniversityLoading(true);
      setUniversityError("");
      const params = new URLSearchParams({
        q: universityQuery,
        state: universityState,
        ownership: universityOwnership,
        degreeGranting: universityDegreeGranting,
        page: String(universityPage),
        pageSize: "24",
      });
      api<UniversityResults>(`/universities?${params}`)
        .then((result) => {
          if (!active) return;
          setUniversities(result.results);
          setUniversityTotal(result.total);
          setDirectoryYear(result.sourceYear);
          setDirectorySourceUrl(result.sourceUrl);
        })
        .catch((error) => {
          if (!active) return;
          setUniversityError(
            error instanceof Error
              ? error.message
              : "The university directory is unavailable.",
          );
        })
        .finally(() => {
          if (active) setUniversityLoading(false);
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    view,
    universityQuery,
    universityState,
    universityOwnership,
    universityDegreeGranting,
    universityPage,
  ]);

  const filtered = useMemo(
    () =>
      scholarships.filter((item) => {
        const text =
          `${item.title} ${item.provider} ${item.field} ${item.description}`.toLowerCase();
        return (
          text.includes(query.trim().toLowerCase()) &&
          (degree === "All degrees" || item.degreeLevel === degree) &&
          (funding === "Any award" || item.fundingType === funding) &&
          (view !== "saved" || saved.includes(item.id))
        );
      }),
    [scholarships, query, degree, funding, view, saved],
  );
  const profileCompletion = Math.min(
    100,
    (session ? 25 : 0) +
      Math.round(
        (Object.values(profile).filter(Boolean).length /
          Object.keys(profile).length) *
          75,
      ),
  );

  const toggleSaved = (id: string) =>
    setSaved((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  const toggleSavedUniversity = (university: University) =>
    setSavedUniversities((current) =>
      current.some((item) => item.id === university.id)
        ? current.filter((item) => item.id !== university.id)
        : [...current, university],
    );

  async function startApplication(item: Scholarship) {
    if (!session) {
      setSelected(null);
      setAuthMode("create");
      setAuthOpen(true);
      return;
    }
    try {
      const created = await api<{
        id: string;
        scholarshipId: string;
        status: string;
      }>("/applications", {
        method: "POST",
        body: JSON.stringify({ scholarshipId: item.id }),
      });
      setApplications((current) => [
        { ...created, createdAt: new Date().toISOString() },
        ...current.filter(
          (application) => application.scholarshipId !== item.id,
        ),
      ]);
      setNotice("Your application draft is ready.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not create your application.",
      );
      return;
    }
    setSelected(null);
    setView("applications");
  }

  async function authenticate() {
    setAuthError("");

    if (authMode === "verify") {
      try {
        await api<{ message: string }>("/auth/verify-email", {
          method: "POST",
          body: JSON.stringify({ email, token: verificationToken }),
        });
        setAuthMode("signin");
        setVerificationPending(false);
        setVerificationToken("");
        setAuthOpen(false);
        setNotice("Email verified. You can now sign in.");
        return;
      } catch (error) {
        setAuthError(
          error instanceof Error
            ? error.message
            : "Could not verify this email.",
        );
        return;
      }
    }

    try {
      const path = authMode === "create" ? "/auth/register" : "/auth/login";
      const payload =
        authMode === "create"
          ? { email, password, firstName, lastName }
          : { email, password };
      const result = await api<{
        token?: string;
        emailVerificationRequired?: boolean;
        email?: string;
        user?: { student?: { firstName: string; lastName: string } };
      }>(path, { method: "POST", body: JSON.stringify(payload) });

      if (result.emailVerificationRequired) {
        setVerificationPending(true);
        setVerificationToken("");
        setAuthMode("verify");
        setAuthError("");
        setNotice("Account created. Verify your email to continue.");
        return;
      }

      if (!result.token) {
        throw new Error("No account token was returned.");
      }

      localStorage.setItem("sb_token", result.token);
      if (result.user?.student) {
        localStorage.setItem("sb_first_name", result.user.student.firstName);
        localStorage.setItem("sb_last_name", result.user.student.lastName);
        setSession(result.user.student.firstName);
      } else {
        setSession("account");
      }
    } catch (error) {
      setAuthError(
        error instanceof TypeError
          ? "Account services are unavailable. Please try again shortly."
          : error instanceof Error
            ? error.message
            : "Could not sign in.",
      );
      if (
        error instanceof Error &&
        /Email verification required|account was created/i.test(error.message)
      ) {
        setVerificationPending(true);
        setVerificationToken("");
        setAuthMode("verify");
      }
      return;
    }
    setAuthOpen(false);
    setView("applications");
    setNotice("Your student workspace is ready.");
  }

  function logout() {
    localStorage.removeItem("sb_token");
    localStorage.removeItem("sb_first_name");
    localStorage.removeItem("sb_last_name");
    setSession("");
    setView("discover");
  }

  async function submitApplication(id: string) {
    try {
      await api(`/applications/${id}/submit`, { method: "POST" });
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not submit this application.",
      );
      return;
    }
    setApplications((current) =>
      current.map((application) =>
        application.id === id
          ? { ...application, status: "SUBMITTED" }
          : application,
      ),
    );
    setNotice("Your application was submitted.");
  }

  async function saveProfile() {
    setProfileStatus("Saving...");
    try {
      if (!localStorage.getItem("sb_token"))
        throw new Error("Sign in to save your profile.");
      await api("/students/me", {
        method: "PUT",
        body: JSON.stringify({
          firstName: localStorage.getItem("sb_first_name") || "Student",
          lastName: localStorage.getItem("sb_last_name") || "User",
          ...profile,
          gpa: profile.gpa ? Number(profile.gpa) : undefined,
        }),
      });
      setProfileStatus("Profile saved to your account.");
    } catch (error) {
      setProfileStatus(
        error instanceof Error ? error.message : "Could not save this profile.",
      );
    }
  }

  const navItems: { id: View; label: string; icon: string }[] = [
    { id: "discover", label: "Discover", icon: "⌕" },
    { id: "universities", label: "Universities", icon: "⌂" },
    { id: "saved", label: "Saved", icon: "♡" },
    { id: "applications", label: "Applications", icon: "▤" },
    { id: "profile", label: "My profile", icon: "◉" },
  ];

  return (
    <div className="app-shell">
      <aside
        id="student-workspace-navigation"
        className={mobileMenuOpen ? "sidebar mobile-open" : "sidebar"}
        aria-label="Student workspace navigation"
      >
        <button
          className="brand"
          onClick={() => {
            setView("discover");
            setMobileMenuOpen(false);
          }}
          aria-label="ScholarBridge home"
        >
          <span className="brand-mark">S</span>
          <span>
            ScholarBridge<small>STUDENT DESK</small>
          </span>
        </button>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              className={view === item.id ? "nav-item active" : "nav-item"}
              key={item.id}
              onClick={() => {
                setView(item.id);
                setMobileMenuOpen(false);
                mobileMenuButton.current?.focus();
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.id === "saved" &&
                saved.length + savedUniversities.length > 0 && (
                  <span className="nav-count">
                    {saved.length + savedUniversities.length}
                  </span>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-box">
            <span className="help-icon">?</span>
            <b>Need a hand?</b>
            <p>Keep your next steps clear and your application moving.</p>
            <button onClick={() => setView("profile")}>
              View your profile <span>↗</span>
            </button>
          </div>
          <div className="user-row">
            <div className="avatar">
              {session ? session.slice(0, 1).toUpperCase() : "S"}
            </div>
            <div className="user-label">
              <b>{session || "Student workspace"}</b>
              <small>
                {session ? "Personal workspace" : "Browse as a guest"}
              </small>
            </div>
            {session && (
              <button
                className="logout-button"
                onClick={logout}
                aria-label="Sign out"
                title="Sign out"
              >
                ↗
              </button>
            )}
          </div>
        </div>
      </aside>
      {mobileMenuOpen && (
        <button
          className="mobile-menu-backdrop"
          onClick={() => {
            setMobileMenuOpen(false);
            mobileMenuButton.current?.focus();
          }}
          aria-label="Close navigation menu"
        />
      )}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-leading">
            <button
              ref={mobileMenuButton}
              className="mobile-menu-trigger"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="student-workspace-navigation"
            >
              <span
                className={mobileMenuOpen ? "menu-glyph open" : "menu-glyph"}
              >
                <i />
                <i />
                <i />
              </span>
            </button>
            <div className="breadcrumb">
              ScholarBridge <span>/</span>{" "}
              {navItems.find((item) => item.id === view)?.label}
            </div>
          </div>
          <div className="topbar-actions">
            {session ? (
              <button
                className="top-profile"
                onClick={() => setView("profile")}
              >
                <span className="avatar tiny">
                  {session.slice(0, 1).toUpperCase()}
                </span>
                {session}
              </button>
            ) : (
              <button
                className="sign-in-link"
                onClick={() => {
                  setAuthMode("signin");
                  setAuthOpen(true);
                }}
              >
                Sign in <span>↗</span>
              </button>
            )}
          </div>
        </header>
        {notice && (
          <div className="notice" role="status">
            {notice}
            <button onClick={() => setNotice("")} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        {view === "discover" && (
          <section className="page-content">
            <div className="welcome-row">
              <div>
                <div className="eyebrow">
                  A clearer path to your next chapter
                </div>
                <h1>
                  Find the funding
                  <br />
                  that moves you forward.
                </h1>
                <p className="intro-copy">
                  Explore opportunities, keep your shortlist close, and take
                  each application one step at a time.
                </p>
              </div>
              <div className="hero-art">
                <img
                  src="/images/campus.jpg"
                  alt="University campus building framed by trees"
                />
                <div className="art-caption">
                  <span>YOUR NEXT CHAPTER</span>
                  <b>Starts with one good match.</b>
                </div>
                <div className="art-stamp">
                  SB
                  <br />
                  <small>2026</small>
                </div>
              </div>
            </div>
            <div className="search-panel">
              <label className="search-field">
                <span>⌕</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by subject, degree, or keyword"
                  aria-label="Search scholarships"
                />
                <kbd>/</kbd>
              </label>
              <div className="filter-divider" />
              <label className="filter-select">
                <span>DEGREE</span>
                <select
                  value={degree}
                  onChange={(event) => setDegree(event.target.value)}
                >
                  <option>All degrees</option>
                  <option>Undergraduate</option>
                  <option>Master's</option>
                  <option>Doctoral</option>
                </select>
              </label>
              <label className="filter-select">
                <span>FUNDING</span>
                <select
                  value={funding}
                  onChange={(event) => setFunding(event.target.value)}
                >
                  <option>Any award</option>
                  <option value="FULL">Full funding</option>
                  <option value="PARTIAL">Partial funding</option>
                </select>
              </label>
            </div>
            <div className="section-heading">
              <div>
                <span className="eyebrow">THE OPPORTUNITY BOARD</span>
                <h2>
                  {query || degree !== "All degrees" || funding !== "Any award"
                    ? "Matching opportunities"
                    : "Opportunities to explore"}
                </h2>
              </div>
              <span className="result-count">
                {filtered.length}{" "}
                {filtered.length === 1 ? "opportunity" : "opportunities"}
              </span>
            </div>
            {loading && (
              <div className="loading-line">
                <span /> Checking current opportunities...
              </div>
            )}
            {scholarshipError && (
              <div className="university-error" role="alert">
                <b>Scholarships temporarily unavailable</b>
                <p>{scholarshipError}</p>
              </div>
            )}
            <div className="scholarship-list">
              {filtered.map((item, index) => (
                <ScholarshipCard
                  key={item.id}
                  item={item}
                  index={index}
                  saved={saved.includes(item.id)}
                  onSave={() => toggleSaved(item.id)}
                  onOpen={() => setSelected(item)}
                />
              ))}
            </div>
            {!loading && !scholarshipError && !filtered.length && (
              <div className="empty-state">
                <span>⌕</span>
                <h3>
                  {scholarships.length
                    ? "No matches this time"
                    : "No opportunities published yet"}
                </h3>
                <p>
                  {scholarships.length
                    ? "Try a broader search or adjust your filters."
                    : "Scholarship listings will appear here once verified opportunities are published."}
                </p>
                {scholarships.length > 0 && (
                  <button
                    onClick={() => {
                      setQuery("");
                      setDegree("All degrees");
                      setFunding("Any award");
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
            <div className="data-note">
              <span>ⓘ</span>
              <p>
                Scholarship information should be confirmed with the funding
                provider. Check each listing’s source and eligibility details
                before applying.
              </p>
            </div>
          </section>
        )}

        {view === "universities" && (
          <section className="page-content secondary-page university-page">
            <div className="eyebrow">THE NATIONAL INSTITUTION DIRECTORY</div>
            <div className="section-title-row university-title-row">
              <div>
                <h1>Find your U.S. university.</h1>
                <p className="intro-copy">
                  Explore U.S. colleges and universities, compare institution
                  details, then apply directly through each school’s admissions
                  page.
                </p>
              </div>
              <div className="directory-total">
                <b>
                  {universityTotal ? universityTotal.toLocaleString() : "—"}
                </b>
                <span>MATCHING SCHOOLS</span>
              </div>
            </div>
            <form
              className="university-search-panel"
              onSubmit={(event) => {
                event.preventDefault();
                setUniversityQuery(universityInput.trim());
                setUniversityPage(0);
              }}
            >
              <label className="university-search">
                <span>⌕</span>
                <input
                  value={universityInput}
                  onChange={(event) => setUniversityInput(event.target.value)}
                  placeholder="Search schools by name"
                  aria-label="Search U.S. universities"
                />
              </label>
              <label className="university-filter">
                <span>STATE</span>
                <select
                  value={universityState}
                  onChange={(event) => {
                    setUniversityState(event.target.value);
                    setUniversityPage(0);
                  }}
                >
                  <option value="">All states</option>
                  {usStates.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="university-filter">
                <span>OWNERSHIP</span>
                <select
                  value={universityOwnership}
                  onChange={(event) => {
                    setUniversityOwnership(event.target.value);
                    setUniversityPage(0);
                  }}
                >
                  <option value="">All institutions</option>
                  <option>Public</option>
                  <option>Private nonprofit</option>
                  <option>Private for-profit</option>
                </select>
              </label>
              <label className="university-filter">
                <span>DEGREES</span>
                <select
                  value={universityDegreeGranting}
                  onChange={(event) => {
                    setUniversityDegreeGranting(event.target.value);
                    setUniversityPage(0);
                  }}
                >
                  <option value="1">Degree-granting schools</option>
                  <option value="">All active schools</option>
                  <option value="0">Non-degree</option>
                </select>
              </label>
              <button className="university-search-button" type="submit">
                Search <span>↗</span>
              </button>
            </form>
            <div className="university-results-heading">
              <div>
                <span className="eyebrow">
                  IPEDS {directoryYear} · NATIONAL CENTER FOR EDUCATION
                  STATISTICS
                </span>
                <h2>
                  {universityQuery || universityState || universityOwnership
                    ? "Matching schools"
                    : universityDegreeGranting === "0"
                      ? "Non-degree institutions"
                      : universityDegreeGranting === ""
                        ? "All active institutions"
                        : "Degree-granting schools"}
                </h2>
              </div>
              <span>
                {universityTotal
                  ? `${universityTotal.toLocaleString()} institutions`
                  : "National directory"}
              </span>
            </div>
            {universityLoading && (
              <div className="university-state">
                <span className="loading-dot" /> Loading the federal
                directory...
              </div>
            )}
            {universityError && (
              <div className="university-error" role="alert">
                <b>Directory temporarily unavailable</b>
                <p>{universityError}</p>
                <span>
                  The searchable IPEDS snapshot is bundled with the backend.
                </span>
              </div>
            )}
            {!universityLoading &&
              !universityError &&
              universities.length > 0 && (
                <div className="university-grid">
                  {universities.map((university) => (
                    <UniversityCard
                      key={university.id}
                      university={university}
                      saved={savedUniversities.some(
                        (item) => item.id === university.id,
                      )}
                      onSave={() => toggleSavedUniversity(university)}
                    />
                  ))}
                </div>
              )}
            {!universityLoading && !universityError && !universities.length && (
              <div className="empty-state">
                <span>⌕</span>
                <h3>No schools found</h3>
                <p>Try another name or broaden your filters.</p>
                <button
                  onClick={() => {
                    setUniversityInput("");
                    setUniversityQuery("");
                    setUniversityState("");
                    setUniversityOwnership("");
                    setUniversityDegreeGranting("1");
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
            {!universityError && universityTotal > 0 && (
              <div className="university-pagination">
                <span>
                  Showing {universityPage * 24 + 1}–
                  {Math.min((universityPage + 1) * 24, universityTotal)} of{" "}
                  {universityTotal.toLocaleString()}
                </span>
                <div>
                  <button
                    disabled={universityPage === 0 || universityLoading}
                    onClick={() =>
                      setUniversityPage((page) => Math.max(0, page - 1))
                    }
                  >
                    ← Previous
                  </button>
                  <span>
                    Page {universityPage + 1} of{" "}
                    {Math.ceil(universityTotal / 24).toLocaleString()}
                  </span>
                  <button
                    disabled={
                      (universityPage + 1) * 24 >= universityTotal ||
                      universityLoading
                    }
                    onClick={() => setUniversityPage((page) => page + 1)}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
            <div className="directory-source">
              <span>ⓘ</span>
              <p>
                Directory data:{" "}
                <a href={directorySourceUrl} target="_blank" rel="noreferrer">
                  IPEDS {directoryYear}, National Center for Education
                  Statistics
                </a>
                . This annual snapshot includes active U.S. institutions across
                degree levels. Confirm current program, admissions, cost, and
                deadline details directly with each school.
              </p>
            </div>
          </section>
        )}

        {view === "saved" && (
          <section className="page-content secondary-page">
            <div className="eyebrow">YOUR SHORTLIST</div>
            <h1>Saved opportunities</h1>
            <p className="intro-copy">
              A little room to think before you decide.
            </p>
            {savedUniversities.length > 0 && (
              <>
                <div className="university-results-heading saved-schools-heading">
                  <div>
                    <span className="eyebrow">SCHOOL SHORTLIST</span>
                    <h2>Universities to explore</h2>
                  </div>
                  <span>{savedUniversities.length} saved</span>
                </div>
                <div className="university-grid">
                  {savedUniversities.map((university) => (
                    <UniversityCard
                      key={university.id}
                      university={university}
                      saved
                      onSave={() => toggleSavedUniversity(university)}
                    />
                  ))}
                </div>
              </>
            )}
            <div className="university-results-heading saved-schools-heading">
              <div>
                <span className="eyebrow">FUNDING SHORTLIST</span>
                <h2>Saved scholarships</h2>
              </div>
              <span>{saved.length} saved</span>
            </div>
            <div className="scholarship-list">
              {filtered.map((item, index) => (
                <ScholarshipCard
                  key={item.id}
                  item={item}
                  index={index}
                  saved
                  onSave={() => toggleSaved(item.id)}
                  onOpen={() => setSelected(item)}
                />
              ))}
            </div>
            {!filtered.length && !savedUniversities.length && (
              <div className="empty-state">
                <span>♡</span>
                <h3>Your shortlist is waiting</h3>
                <p>
                  Save a university or scholarship to keep it close while you
                  compare.
                </p>
                <button onClick={() => setView("universities")}>
                  Explore universities
                </button>
              </div>
            )}
          </section>
        )}

        {view === "applications" && (
          <section className="page-content secondary-page">
            <div className="eyebrow">YOUR NEXT STEPS</div>
            <div className="section-title-row">
              <div>
                <h1>My applications</h1>
                <p className="intro-copy">
                  Everything you’re working on, in one place.
                </p>
              </div>
              <button
                className="button-dark"
                onClick={() => setView("discover")}
              >
                Explore awards <span>↗</span>
              </button>
            </div>
            <div className="application-summary">
              <div>
                <span>IN PROGRESS</span>
                <b>
                  {applications
                    .filter((application) => application.status === "DRAFT")
                    .length.toString()
                    .padStart(2, "0")}
                </b>
              </div>
              <div>
                <span>SUBMITTED</span>
                <b>
                  {applications
                    .filter((application) => application.status !== "DRAFT")
                    .length.toString()
                    .padStart(2, "0")}
                </b>
              </div>
              <div>
                <span>SAVED FOR LATER</span>
                <b>{saved.length.toString().padStart(2, "0")}</b>
              </div>
            </div>
            <div className="section-heading compact">
              <div>
                <span className="eyebrow">APPLICATION TRACKER</span>
                <h2>Your current applications</h2>
              </div>
            </div>
            {applications.length ? (
              <div className="application-list">
                {applications.map((application) => {
                  const item = scholarships.find(
                    (scholarship) =>
                      scholarship.id === application.scholarshipId,
                  );
                  return (
                    <article className="application-row" key={application.id}>
                      <div className="application-icon">
                        {application.status === "DRAFT" ? "◷" : "✓"}
                      </div>
                      <div className="application-name">
                        <b>{item?.title || "Scholarship application"}</b>
                        <span>
                          {item?.provider || "ScholarBridge"} · Added{" "}
                          {new Date(application.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <span
                        className={
                          application.status === "DRAFT"
                            ? "status-pill draft"
                            : "status-pill submitted"
                        }
                      >
                        {application.status === "DRAFT" ? "Draft" : "Submitted"}
                      </span>
                      {application.status === "DRAFT" && (
                        <button
                          className="text-button"
                          onClick={() => submitApplication(application.id)}
                        >
                          Mark submitted <span>↗</span>
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <span>▤</span>
                <h3>Your application list is clear</h3>
                <p>Start with an opportunity that fits your goals.</p>
                <button onClick={() => setView("discover")}>
                  Browse opportunities
                </button>
              </div>
            )}
          </section>
        )}

        {view === "profile" && (
          <section className="page-content secondary-page">
            <div className="eyebrow">THE DETAILS THAT HELP YOU MATCH</div>
            <h1>Your student profile</h1>
            <p className="intro-copy">
              Keep your study goals and academic details together in your
              account.
            </p>
            <div className="profile-layout">
              <div className="profile-card">
                <div className="profile-heading">
                  <div className="avatar large">
                    {session ? session.slice(0, 1).toUpperCase() : "?"}
                  </div>
                  <div>
                    <h2>{session || "Your profile"}</h2>
                    <p>
                      {session ? email || "Student workspace" : "Guest profile"}
                    </p>
                  </div>
                </div>
                <div className="profile-progress">
                  <div>
                    <span>PROFILE COMPLETENESS</span>
                    <b>{profileCompletion}%</b>
                  </div>
                  <div className="progress-track">
                    <i style={{ width: `${profileCompletion}%` }} />
                  </div>
                </div>
                <div className="profile-fields">
                  <label>
                    Country of residence
                    <input
                      value={profile.country}
                      onChange={(event) =>
                        setProfile({ ...profile, country: event.target.value })
                      }
                      placeholder="e.g. Ghana"
                    />
                  </label>
                  <label>
                    Citizenship
                    <input
                      value={profile.citizenship}
                      onChange={(event) =>
                        setProfile({
                          ...profile,
                          citizenship: event.target.value,
                        })
                      }
                      placeholder="e.g. Ghanaian"
                    />
                  </label>
                  <label>
                    Intended degree
                    <select
                      value={profile.degreeLevel}
                      onChange={(event) =>
                        setProfile({
                          ...profile,
                          degreeLevel: event.target.value,
                        })
                      }
                    >
                      <option value="">Choose a level</option>
                      <option>Undergraduate</option>
                      <option>Master's</option>
                      <option>Doctoral</option>
                    </select>
                  </label>
                  <label>
                    Area of study
                    <input
                      value={profile.field}
                      onChange={(event) =>
                        setProfile({ ...profile, field: event.target.value })
                      }
                      placeholder="e.g. Public health"
                    />
                  </label>
                  <label>
                    Current GPA
                    <input
                      type="number"
                      min="0"
                      max="4"
                      step="0.01"
                      value={profile.gpa}
                      onChange={(event) =>
                        setProfile({ ...profile, gpa: event.target.value })
                      }
                      placeholder="0.00 - 4.00"
                    />
                  </label>
                  <label>
                    Target start date
                    <input
                      value={profile.targetIntake}
                      onChange={(event) =>
                        setProfile({
                          ...profile,
                          targetIntake: event.target.value,
                        })
                      }
                      placeholder="e.g. Fall 2027"
                    />
                  </label>
                  <label className="profile-wide">
                    Funding needed
                    <select
                      value={profile.fundingNeed}
                      onChange={(event) =>
                        setProfile({
                          ...profile,
                          fundingNeed: event.target.value,
                        })
                      }
                    >
                      <option value="">Select your funding need</option>
                      <option>Full funding</option>
                      <option>Partial funding</option>
                      <option>Tuition support</option>
                      <option>Living expenses</option>
                    </select>
                  </label>
                </div>
                <div className="profile-save-row">
                  <span role="status">{profileStatus}</span>
                  <button className="button-dark" onClick={saveProfile}>
                    Save profile <span>↗</span>
                  </button>
                </div>
              </div>
              <div className="profile-aside">
                <span className="eyebrow">YOUR NEXT STEP</span>
                <h3>Start with what you know.</h3>
                <p>
                  Your study level, subject, and funding needs can help you
                  compare opportunities. Keep your profile current as your plans
                  take shape.
                </p>
                <button
                  className="text-button"
                  onClick={() => setView("discover")}
                >
                  Back to discovery <span>↗</span>
                </button>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="site-footer">
        <span>
          ScholarBridge <i>·</i> Student Desk
        </span>
        <span>
          University directory data: IPEDS
        </span>
      </footer>
      {selected && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <section
            className="detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
          >
            <button
              className="modal-close"
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              ×
            </button>
            <div className="eyebrow">
              {selected.verificationStatus === "VERIFIED"
                ? "VERIFIED OPPORTUNITY"
                : "OPPORTUNITY · NEEDS REVIEW"}
            </div>
            <h2 id="detail-title">{selected.title}</h2>
            <p className="detail-provider">
              {selected.provider} <span>·</span> {selected.field}
            </p>
            <div className="detail-amount">
              <span>AWARD AMOUNT</span>
              <b>{selected.amountText}</b>
            </div>
            <p className="detail-description">{selected.description}</p>
            <div className="detail-facts">
              <div>
                <span>DEGREE LEVEL</span>
                <b>{selected.degreeLevel}</b>
              </div>
              <div>
                <span>FUNDING TYPE</span>
                <b>
                  {selected.fundingType === "FULL"
                    ? "Full funding"
                    : "Partial funding"}
                </b>
              </div>
              <div>
                <span>DEADLINE</span>
                <b>
                  {selected.deadline
                    ? new Date(
                        `${selected.deadline}T12:00:00`,
                      ).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "Not specified"}
                </b>
              </div>
            </div>
            <div className="detail-warning">
              Confirm eligibility, deadlines, and funding details with the
              official provider before applying.
              {selected.sourceUrl && (
                <a href={selected.sourceUrl} target="_blank" rel="noreferrer">
                  View official listing ↗
                </a>
              )}
            </div>
            <div className="modal-actions">
              <button
                className="button-outline"
                onClick={() => toggleSaved(selected.id)}
              >
                {saved.includes(selected.id) ? "♥ Saved" : "♡ Save for later"}
              </button>
              <button
                className="button-dark"
                onClick={() => startApplication(selected)}
              >
                Start an application <span>↗</span>
              </button>
            </div>
          </section>
        </div>
      )}
      {authOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAuthOpen(false);
          }}
        >
          <section
            className="auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
          >
            <button
              className="modal-close"
              onClick={() => setAuthOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
            <div className="brand-mark">S</div>
            <div className="eyebrow">YOUR STUDENT DESK</div>
            {authMode === "verify" ? (
              <>
                <h2 id="auth-title">Verify your email</h2>
                <p>
                  Finish setup by confirming the verification code from your
                  inbox.
                </p>
                <label className="auth-label">
                  Verification code
                  <input
                    type="text"
                    value={verificationToken}
                    onChange={(event) =>
                      setVerificationToken(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="Six-digit code"
                    inputMode="numeric"
                    maxLength={6}
                    autoFocus
                    autoComplete="one-time-code"
                  />
                </label>
                {authError && (
                  <p className="auth-error" role="alert">
                    {authError}
                  </p>
                )}
                <button
                  className="button-dark auth-submit"
                  onClick={authenticate}
                >
                  Confirm email <span>↗</span>
                </button>
                <div className="auth-switch">
                  Need a new code?{" "}
                  <button
                    onClick={async () => {
                      setAuthError("");
                      try {
                        await api<{ message: string }>(
                          `/auth/resend-verification`,
                          { method: "POST", body: JSON.stringify({ email }) },
                        );
                        setNotice("If your account needs verification, a new code has been sent.");
                      } catch (error) {
                        setAuthError(
                          error instanceof Error
                            ? error.message
                            : "Could not resend the code.",
                        );
                      }
                    }}
                  >
                    Resend
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="auth-title">
                  {authMode === "create"
                    ? "Make room for what’s next."
                    : "Welcome back."}
                </h2>
                <p>
                  {authMode === "create"
                    ? "Create a workspace to save opportunities and track your applications."
                    : "Sign in to continue with your applications."}
                </p>
                {authMode === "create" && (
                  <div className="name-fields">
                    <label>
                      First name
                      <input
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        autoComplete="given-name"
                      />
                    </label>
                    <label>
                      Last name
                      <input
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        autoComplete="family-name"
                      />
                    </label>
                  </div>
                )}
                <label className="auth-label">
                  Email address
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                  />
                </label>
                <label className="auth-label">
                  Password
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={
                      authMode === "create"
                        ? "new-password"
                        : "current-password"
                    }
                  />
                </label>
                {authError && (
                  <p className="auth-error" role="alert">
                    {authError}
                  </p>
                )}
                <button
                  className="button-dark auth-submit"
                  onClick={authenticate}
                >
                  {authMode === "create" ? "Create workspace" : "Sign in"}{" "}
                  <span>↗</span>
                </button>
                <div className="auth-switch">
                  {authMode === "create"
                    ? "Already have a workspace?"
                    : "New to ScholarBridge?"}{" "}
                  <button
                    onClick={() => {
                      setAuthError("");
                      setAuthMode(authMode === "create" ? "signin" : "create");
                      setVerificationPending(false);
                      setVerificationToken("");
                    }}
                  >
                    {" "}
                    {authMode === "create" ? "Sign in" : "Create one"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function UniversityCard({
  university,
  saved,
  onSave,
}: {
  university: University;
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <article className="university-card">
      <div className="university-card-top">
        <span className="university-source-mark">US</span>
        <span className="university-sector">{university.ownership}</span>
        {university.degreeGranting && (
          <span className="university-sector degree-sector">
            Degree-granting
          </span>
        )}
        <button
          className={saved ? "save-button saved" : "save-button"}
          onClick={onSave}
          aria-label={
            saved
              ? `Remove ${university.name} from saved`
              : `Save ${university.name}`
          }
          title={saved ? "Remove from saved" : "Save university"}
        >
          {saved ? "♥" : "♡"}
        </button>
      </div>
      <h3>{university.name}</h3>
      <p className="university-location">
        {university.city ? `${university.city}, ` : ""}
        {university.state}
        {university.zip ? ` ${university.zip}` : ""} <span>·</span>{" "}
        {university.level}
      </p>
      <div className="university-metrics">
        <div>
          <span>IPEDS UNITID</span>
          <b>{university.id}</b>
        </div>
        <div>
          <span>INSTITUTION TYPE</span>
          <b>{university.degreeGranting ? "Awards degrees" : "Non-degree"}</b>
        </div>
      </div>
      <div className="university-links">
        {university.applicationUrl && (
          <a
            className="university-apply"
            href={university.applicationUrl}
            target="_blank"
            rel="noreferrer"
          >
            Apply on school site <span>↗</span>
          </a>
        )}
        {university.website && (
          <a
            className="university-visit"
            href={university.website}
            target="_blank"
            rel="noreferrer"
          >
            Official website <span>↗</span>
          </a>
        )}
        {university.financialAidUrl && (
          <a
            className="university-aid"
            href={university.financialAidUrl}
            target="_blank"
            rel="noreferrer"
          >
            Financial aid
          </a>
        )}
        {!university.applicationUrl && (
          <span className="university-no-site">
            No direct admissions URL in IPEDS
          </span>
        )}
        {!university.website && (
          <span className="university-no-site">
            Official website not listed
          </span>
        )}
      </div>
    </article>
  );
}

function ScholarshipCard({
  item,
  index,
  saved,
  onSave,
  onOpen,
}: {
  item: Scholarship;
  index: number;
  saved: boolean;
  onSave: () => void;
  onOpen: () => void;
}) {
  return (
    <article
      className="scholarship-card"
      style={{ animationDelay: `${index * 65}ms` }}
    >
      <div className="card-accent" />
      <div className="scholarship-main">
        <div className="card-meta">
          <span className="scholarship-status">
            <i /> {item.verificationStatus === "VERIFIED" ? "VERIFIED" : "NEEDS REVIEW"}
          </span>
          <span className="card-field">{item.field}</span>
        </div>
        <button className="card-title" onClick={onOpen}>
          {item.title}
          <span>↗</span>
        </button>
        <p className="card-description">{item.description}</p>
        <div className="card-tags">
          <span>{item.degreeLevel}</span>
          <span>
            {item.fundingType === "FULL" ? "Full funding" : "Partial funding"}
          </span>
          <span>{item.provider}</span>
        </div>
      </div>
      <div className="card-award">
        <span>AWARD</span>
        <b>{item.amountText}</b>
        <div>
          <span>DEADLINE</span>
          <b>
            {item.deadline
              ? new Date(`${item.deadline}T12:00:00`).toLocaleDateString(
                  undefined,
                  { month: "short", day: "numeric", year: "numeric" },
                )
              : "Not specified"}
          </b>
        </div>
      </div>
      <div className="card-actions">
        <button
          className={saved ? "save-button saved" : "save-button"}
          onClick={onSave}
          aria-label={saved ? "Remove from saved" : "Save scholarship"}
          title={saved ? "Remove from saved" : "Save scholarship"}
        >
          {saved ? "♥" : "♡"}
        </button>
        <button className="view-button" onClick={onOpen}>
          View details <span>↗</span>
        </button>
      </div>
    </article>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
