import 'dotenv/config'
import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import axios from 'axios'
import nodemailer from 'nodemailer'
import QRCodeLib from 'qrcode'
import rateLimit from 'express-rate-limit'
import ws from 'ws'
import aiRoutes from './server/routes/ai.js'
import aiKnowledgeRoutes from './server/routes/aiKnowledge.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(__dirname, "upload");
const distDir = path.resolve(__dirname, "dist");

try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch {
  // Read-only filesystem / serverless environment fallback
}

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { realtime: { transport: ws } }
);

const BUCKET_NAME = "uploads";

async function ensureBucketExists() {
  try {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    if (!buckets?.some((b) => b.name === BUCKET_NAME)) {
      await supabaseAdmin.storage.createBucket(BUCKET_NAME, { public: true });
    }
  } catch (err) {
    // Non-fatal if bucket exists or restricted
  }
}
ensureBucketExists();

// --- Helpers ---

const escapeHtml = (str) => {
  if (typeof str !== "string") return "";
  return str.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ])
  );
};

const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user)
    return res.status(401).json({ error: "Unauthorized" });
  req.user = data.user;
  next();
};

const requireRole =
  (...roles) =>
  async (req, res, next) => {
    const { data: admin } = await supabaseAdmin
      .from("admin_users")
      .select("*, role:admin_roles(name)")
      .eq("user_id", req.user.id)
      .single();
    if (!admin?.is_active) return res.status(403).json({ error: "Forbidden" });
    const userRole = admin.role?.name;
    if (!roles.includes(userRole) && userRole !== "super_admin")
      return res.status(403).json({ error: "Forbidden" });
    req.adminProfile = admin;
    next();
  };

// --- Rate limiting ---

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

// --- Multer with file-type whitelist (in-memory for cloud/serverless) ---

const allowedExts = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext) && allowedMimes.includes(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error(`File type ${ext} not allowed`));
  },
});

const app = express();
app.set("trust proxy", 1);

// CORS (must be early)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// --- File uploads (BEFORE json parser so body stream is intact) ---

const uploadRouter = express.Router();
uploadRouter.post(
  "/upload",
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: "No file provided" });
      next();
    });
  },
  requireAuth,
  async (req, res) => {
    try {
      const ext = path.extname(req.file.originalname).toLowerCase();
      const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 13)}${ext}`;

      const { error } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(filename, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true,
        });

      if (error) {
        console.error("Supabase storage upload error:", error);
        return res.status(500).json({ error: "Failed to upload file to storage" });
      }

      const { data: publicData } = supabaseAdmin.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filename);

      res.json({ url: publicData.publicUrl });
    } catch (err) {
      console.error("Upload handler error:", err);
      res.status(500).json({ error: "Server upload error" });
    }
  }
);
app.use("/api", uploadRouter);

// --- JSON parser & rate limiter for remaining API routes ---

app.use(express.json());
app.use("/api/", apiLimiter);

app.delete("/api/upload", requireAuth, async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== "string") return res.status(400).json({ error: "No url" });

  try {
    if (url.includes("/storage/v1/object/public/")) {
      const parts = url.split("/storage/v1/object/public/")[1]?.split("/");
      if (parts && parts.length >= 2) {
        const bucket = parts[0];
        const filePath = decodeURIComponent(parts.slice(1).join("/"));
        await supabaseAdmin.storage.from(bucket).remove([filePath]);
      }
    } else if (url.startsWith("/uploads/")) {
      const filename = path.basename(url);
      const filepath = path.join(uploadDir, filename);
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete upload error:", err);
    res.status(500).json({ error: "Failed to delete file" });
  }
});

if (fs.existsSync(uploadDir)) {
  app.use("/uploads", express.static(uploadDir));
}

app.get("/uploads/:filename", async (req, res) => {
  const filename = path.basename(req.params.filename);
  const ext = path.extname(filename).toLowerCase();
  if (!allowedExts.includes(ext)) {
    return res.status(400).json({ error: "Invalid file type" });
  }
  const localPath = path.join(uploadDir, filename);
  if (fs.existsSync(localPath)) {
    return res.sendFile(localPath);
  }
  const { data: publicData } = supabaseAdmin.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filename);
  if (publicData?.publicUrl) {
    return res.redirect(publicData.publicUrl);
  }
  res.status(404).json({ error: "File not found" });
});

// --- Page content (about image, etc.) ---

app.get("/api/page-content/:section", async (req, res) => {
  const { section } = req.params;
  const { data } = await supabaseAdmin
    .from("page_content")
    .select("image_url")
    .eq("section", section)
    .maybeSingle();
  res.json({ image_url: data?.image_url || null });
});

app.put("/api/page-content", requireAuth, async (req, res) => {
  const { section, image_url } = req.body;
  if (!section) return res.status(400).json({ error: "section is required" });
  const { data: existing } = await supabaseAdmin
    .from("page_content")
    .select("id")
    .eq("section", section)
    .maybeSingle();
  if (existing) {
    const { error } = await supabaseAdmin
      .from("page_content")
      .update({ image_url, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return res.status(500).json({ error: error.message });
  } else {
    const { error } = await supabaseAdmin
      .from("page_content")
      .insert({ section, image_url, updated_at: new Date().toISOString() });
    if (error) return res.status(500).json({ error: error.message });
  }
  res.json({ ok: true });
});

// --- Admin user management (service_role required) ---

app.post(
  "/api/admin/users",
  requireAuth,
  requireRole("super_admin"),
  async (req, res) => {
    const { email, password, full_name, role_id } = req.body;
    if (!password || password.length < 8)
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters" });
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
    if (authError) {
      console.error("Create admin auth error:", authError);
      return res.status(400).json({ error: "Failed to create user" });
    }
    const { error: insertError } = await supabaseAdmin
      .from("admin_users")
      .insert({
        user_id: authData.user.id,
        email,
        full_name,
        role_id: parseInt(role_id),
        is_active: true,
      });
    if (insertError) {
      console.error("Create admin insert error:", insertError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(400).json({ error: "Failed to create admin record" });
    }
    res.json({ ok: true });
  }
);

app.delete(
  "/api/admin/users/:id",
  requireAuth,
  requireRole("super_admin"),
  async (req, res) => {
    const { id } = req.params;
    const { data: admin } = await supabaseAdmin
      .from("admin_users")
      .select("user_id")
      .eq("id", id)
      .single();
    if (admin) {
      await supabaseAdmin.auth.admin.deleteUser(admin.user_id);
      await supabaseAdmin.from("admin_users").delete().eq("id", id);
    }
    res.json({ ok: true });
  }
);

// --- Check admin email exists (for password reset) ---

app.post('/api/admin/check-email', authLimiter, async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email is required.' })
  res.json({ ok: true, exists: true })
})

// --- Email auto-reply ---

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(
      `[EMAIL SKIPPED] No SMTP configured. Would send to ${to}: ${subject}`
    );
    return { ok: true, skipped: true };
  }
  await transporter.sendMail({
    from:
      process.env.EMAIL_FROM || '"AFAQ Scientific Club" <noreply@afaq-club.dz>',
    to,
    subject,
    html,
  });
  return { ok: true };
};

app.post("/api/email/registration-confirmation", async (req, res) => {
  const { email, name, event_title, date } = req.body;
  try {
    const safeName = escapeHtml(name);
    const safeEvent = escapeHtml(event_title);
    const safeDate = date ? escapeHtml(date) : "";
    await sendEmail({
      to: email,
      subject: `Registration Confirmed — ${safeEvent}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
          <div style="background: #0F172A; padding: 24px; text-align: center;">
            <h1 style="color: #fff; margin: 0; font-size: 22px;">AFAQ Scientific Club</h1>
          </div>
          <div style="padding: 32px 24px; background: #f8fafc;">
            <h2 style="margin: 0 0 8px;">Hello ${safeName},</h2>
            <p style="color: #475569; font-size: 15px; line-height: 1.6;">
              Thank you for registering for <strong>${safeEvent}</strong>.
              ${
                safeDate
                  ? `The event will take place on <strong>${safeDate}</strong>.`
                  : ""
              }
            </p>
            <p style="color: #475569; font-size: 15px; line-height: 1.6;">
              We look forward to seeing you there! Stay tuned for further details.
            </p>
            <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">
              Best regards,<br/>AFAQ Scientific Club Team
            </p>
          </div>
        </div>
      `,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("Email error:", err);
    res.status(500).json({ error: "Failed to send email" });
  }
});

app.post("/api/email/membership-confirmation", async (req, res) => {
  const { email, name } = req.body;
  try {
    const safeName = escapeHtml(name);
    await sendEmail({
      to: email,
      subject: "Membership Application Received — AFAQ Scientific Club",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
          <div style="background: #0F172A; padding: 24px; text-align: center;">
            <h1 style="color: #fff; margin: 0; font-size: 22px;">AFAQ Scientific Club</h1>
          </div>
          <div style="padding: 32px 24px; background: #f8fafc;">
            <h2 style="margin: 0 0 8px;">Thank You, ${safeName}!</h2>
            <p style="color: #475569; font-size: 15px; line-height: 1.6;">
              We have received your membership application. Our team will review it and
              get back to you soon.
            </p>
            <p style="color: #475569; font-size: 15px; line-height: 1.6;">
              If you have any questions, feel free to reach out to us via the contact page.
            </p>
            <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">
              Best regards,<br/>AFAQ Scientific Club Team
            </p>
          </div>
        </div>
      `,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("Email error:", err);
    res.status(500).json({ error: "Failed to send email" });
  }
});

// --- Public sign-up (seat counts, capacity and duplicate checks) ---
//
// These have to live on the server. Anonymous visitors hold INSERT-only rights
// on event_registrations and membership_applications, so a browser asking
// "how many seats are taken" or "has this email already applied" gets an empty
// result under RLS rather than an answer. The service-role client can see the
// rows, so capacity and duplicate rules are decided here and cannot be
// sidestepped by posting straight at the table.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.get("/api/events/availability", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const { data: events, error: eventsErr } = await supabaseAdmin
      .from("events")
      .select("id, max_participants")
      .eq("is_published", true)
      .eq("registration_open", true)
      .gte("date", today);
    if (eventsErr) throw eventsErr;

    const ids = (events || []).map((e) => e.id);
    const counts = {};
    if (ids.length) {
      const { data: approved, error: regErr } = await supabaseAdmin
        .from("event_registrations")
        .select("event_id")
        .in("event_id", ids)
        .eq("status", "approved");
      if (regErr) throw regErr;
      for (const row of approved || []) {
        counts[row.event_id] = (counts[row.event_id] || 0) + 1;
      }
    }

    // Aggregate counts only — never who registered.
    res.json({
      events: (events || []).map((e) => ({
        id: e.id,
        capacity: e.max_participants || 0,
        taken: counts[e.id] || 0,
      })),
    });
  } catch (err) {
    console.error("Availability error:", err.message);
    res.status(500).json({ error: "Could not load seat availability." });
  }
});

app.post("/api/register/event", async (req, res) => {
  const b = req.body || {};
  const email = String(b.email || "").trim().toLowerCase();
  const fullName = String(b.full_name || "").trim();

  if (!b.event_id) return res.status(400).json({ error: "Choose an event." });
  if (!fullName) return res.status(400).json({ error: "Enter your full name." });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (!b.agreed_to_policies) {
    return res.status(400).json({ error: "You must agree to the policies to register." });
  }

  try {
    const { data: event } = await supabaseAdmin
      .from("events")
      .select("id, date, max_participants, is_published, registration_open")
      .eq("id", b.event_id)
      .maybeSingle();

    const today = new Date().toISOString().split("T")[0];
    if (!event || !event.is_published) {
      return res.status(404).json({ error: "That event is no longer available." });
    }
    if (!event.registration_open || event.date < today) {
      return res.status(409).json({ error: "Registration for this event has closed." });
    }

    const { data: existing } = await supabaseAdmin
      .from("event_registrations")
      .select("id")
      .eq("event_id", event.id)
      .ilike("email", email)
      .limit(1);
    if (existing?.length) {
      return res.status(409).json({
        error: "You have already registered for this event with that email address.",
        code: "duplicate",
      });
    }

    if (event.max_participants > 0) {
      const { count } = await supabaseAdmin
        .from("event_registrations")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("status", "approved");
      if ((count || 0) >= event.max_participants) {
        return res.status(409).json({ error: "This event is full.", code: "full" });
      }
    }

    const { error: insertErr } = await supabaseAdmin.from("event_registrations").insert([{
      event_id: event.id,
      full_name: fullName,
      student_id: b.student_id ? String(b.student_id).trim() : null,
      email,
      phone: b.phone ? String(b.phone).trim() : null,
      department: b.department || null,
      agreed_to_policies: true,
    }]);
    if (insertErr) throw insertErr;

    res.json({ ok: true });
  } catch (err) {
    console.error("Event registration error:", err.message);
    res.status(500).json({ error: "We could not save your registration. Please try again." });
  }
});

app.post("/api/register/membership", async (req, res) => {
  const b = req.body || {};
  const email = String(b.email || "").trim().toLowerCase();
  const fullName = String(b.full_name || "").trim();
  const studentId = b.student_id ? String(b.student_id).trim() : "";

  if (!fullName) return res.status(400).json({ error: "Enter your full name." });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter a valid email address." });

  try {
    // Either identifier already on file is a duplicate.
    const [byEmail, byStudentId] = await Promise.all([
      supabaseAdmin.from("membership_applications").select("id").ilike("email", email).limit(1),
      studentId
        ? supabaseAdmin.from("membership_applications").select("id").eq("student_id", studentId).limit(1)
        : Promise.resolve({ data: [] }),
    ]);
    if (byEmail.data?.length || byStudentId.data?.length) {
      return res.status(409).json({
        error: "An application with this email or student ID has already been submitted.",
        code: "duplicate",
      });
    }

    const { error: insertErr } = await supabaseAdmin.from("membership_applications").insert([{
      full_name: fullName,
      student_id: studentId || null,
      email,
      phone: b.phone ? String(b.phone).trim() : null,
      department: b.department || null,
      study_year: b.study_year || null,
      interests: Array.isArray(b.interests) ? b.interests : [],
      skills: Array.isArray(b.skills) ? b.skills : [],
      motivation: b.motivation ? String(b.motivation).trim() : null,
    }]);
    if (insertErr) throw insertErr;

    res.json({ ok: true });
  } catch (err) {
    console.error("Membership application error:", err.message);
    res.status(500).json({ error: "We could not save your application. Please try again." });
  }
});

// --- Approve endpoints (update DB + send email) ---

app.post(
  "/api/approve/registration",
  requireAuth,
  requireRole("super_admin", "event_manager"),
  async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "Missing id" });

    const { data: reg, error: fetchErr } = await supabaseAdmin
      .from("event_registrations")
      .select("*, event:events(title_en, title_ar, title_fr, date)")
      .eq("id", id)
      .single();
    if (fetchErr || !reg) {
      console.error("Fetch registration error:", fetchErr);
      return res.status(404).json({ error: "Registration not found" });
    }

    const payload = JSON.stringify({
      id: reg.id,
      event: reg.event?.title_en || "",
      name: reg.full_name,
      email: reg.email,
    });
    const qrDataUrl = await QRCodeLib.toDataURL(payload, {
      width: 300,
      margin: 2,
    });

    const { error: updateErr } = await supabaseAdmin
      .from("event_registrations")
      .update({ status: "approved", qr_code: qrDataUrl })
      .eq("id", id);
    if (updateErr) {
      console.error("Update registration error:", updateErr);
      return res.status(500).json({ error: "Failed to approve registration" });
    }

    const eventTitle = reg.event ? reg.event.title_en || "" : "";
    const eventDate = reg.event?.date
      ? new Date(reg.event.date + "T00:00:00").toLocaleDateString()
      : "";
    const safeName = escapeHtml(reg.full_name);
    const safeEvent = escapeHtml(eventTitle);
    const safeDate = escapeHtml(eventDate);

    await sendEmail({
      to: reg.email,
      subject: `Registration Approved — ${safeEvent}`,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: #0F172A; padding: 24px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">AFAQ Scientific Club</h1>
        </div>
        <div style="padding: 32px 24px; background: #f8fafc;">
          <h2 style="margin: 0 0 8px;">Congratulations ${safeName}!</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            Your registration for <strong>${safeEvent}</strong> has been <strong>approved</strong>.
            ${
              safeDate
                ? `The event takes place on <strong>${safeDate}</strong>.`
                : ""
            }
          </p>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            Your QR code is attached below. Please present it at the entrance.
          </p>
          <div style="text-align: center; margin: 20px 0;">
            <img src="${qrDataUrl}" alt="QR Code" style="width: 180px; height: 180px; border-radius: 12px;" />
          </div>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">
            Best regards,<br/>AFAQ Scientific Club Team
          </p>
        </div>
      </div>
    `,
    });

    res.json({ ok: true });
  }
);

app.post(
  "/api/approve/membership",
  requireAuth,
  requireRole("super_admin", "event_manager"),
  async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "Missing id" });

    const { data: app, error: fetchErr } = await supabaseAdmin
      .from("membership_applications")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchErr || !app) {
      console.error("Fetch application error:", fetchErr);
      return res.status(404).json({ error: "Application not found" });
    }

    const { error: updateErr } = await supabaseAdmin
      .from("membership_applications")
      .update({ status: "approved" })
      .eq("id", id);
    if (updateErr) {
      console.error("Update application error:", updateErr);
      return res.status(500).json({ error: "Failed to approve application" });
    }

    const safeName = escapeHtml(app.full_name);

    await sendEmail({
      to: app.email,
      subject: "Membership Approved — Welcome to AFAQ!",
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: #0F172A; padding: 24px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">AFAQ Scientific Club</h1>
        </div>
        <div style="padding: 32px 24px; background: #f8fafc;">
          <h2 style="margin: 0 0 8px;">Welcome to AFAQ, ${safeName}!</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            Your membership application has been <strong>approved</strong>! We are thrilled
            to have you on board.
          </p>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            Stay tuned for upcoming events, workshops, and projects. You are now part of a
            community where technology meets innovation.
          </p>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">
            Best regards,<br/>AFAQ Scientific Club Team
          </p>
        </div>
      </div>
    `,
    });

    res.json({ ok: true });
  }
);

// --- Progres MESRS API proxy ---

const PROGRES_BASE = "https://progres.mesrs.dz/api";
const PROGRES_TIMEOUT = 30_000;

const progresApi = axios.create({
  baseURL: PROGRES_BASE,
  timeout: PROGRES_TIMEOUT,
});

app.post("/api/progres/auth", authLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required." });
  }
  try {
    const { data } = await progresApi.post("/authentication/v1/", {
      username,
      password,
    });
    res.json({ token: data.token, uuid: data.uuid, userName: data.userName });
  } catch (err) {
    if (
      err.response &&
      (err.response.status === 401 || err.response.status === 403)
    ) {
      return res.status(401).json({ error: "Invalid Progres credentials." });
    }
    console.error("Progres auth error:", {
      message: err.message,
      code: err.code,
      status: err.response?.status,
      data: err.response?.data,
    });
    res.status(502).json({ error: "Progres API unreachable." });
  }
});

app.get("/api/progres/student", async (req, res) => {
  const { uuid } = req.query;
  const authHeader = req.headers.authorization;
  if (!uuid || typeof uuid !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(uuid) || !authHeader) {
    return res
      .status(400)
      .json({ error: "Missing or invalid uuid / authorization header." });
  }
  try {
    const encodedUuid = encodeURIComponent(uuid);
    const [individuRes, diasRes] = await Promise.all([
      progresApi.get(`/infos/bac/${encodedUuid}/individu`, {
        headers: { Authorization: authHeader },
      }),
      progresApi.get(`/infos/bac/${encodedUuid}/dias`, {
        headers: { Authorization: authHeader },
      }),
    ]);
    const individu = individuRes.data;
    const dias = diasRes.data;
    if (!Array.isArray(dias) || dias.length === 0) {
      return res.status(404).json({ error: "No academic records found." });
    }
    const sorted = [...dias].sort((a, b) =>
      (b.anneeAcademiqueCode || "").localeCompare(a.anneeAcademiqueCode || "")
    );
    const latest = sorted[0];
    res.json({
      student_id: latest.numeroMatricule || "",
      full_name: `${individu.prenomLatin || ""} ${
        individu.nomLatin || ""
      }`.trim(),
      email: individu.email || "",
      phone: latest.telephoneBachelier || "",
      department: latest.llFiliere || latest.ofLlFiliere || "",
      study_year: latest.niveauLibelleLongLt || "",
      university: latest.llEtablissementLatin || "",
      academic_year: latest.anneeAcademiqueCode || "",
    });
  } catch (err) {
    if (err.response && err.response.status === 401) {
      return res.status(401).json({ error: "Session expired." });
    }
    console.error("Progres student fetch error:", {
      message: err.message,
      code: err.code,
      status: err.response?.status,
      data: err.response?.data,
    });
    res.status(502).json({ error: "Failed to fetch student data." });
  }
});

// --- Public stats (uses service_role to bypass RLS) ---

app.get("/api/stats", async (req, res) => {
  try {
    const [
      { count: events },
      { count: projects },
      { count: registrations },
      { count: memberships },
    ] = await Promise.all([
      supabaseAdmin
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("is_published", true),
      supabaseAdmin
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("is_published", true),
      supabaseAdmin
        .from("event_registrations")
        .select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("membership_applications")
        .select("*", { count: "exact", head: true }),
    ]);
    res.json({
      events: events || 0,
      projects: projects || 0,
      members: (registrations || 0) + (memberships || 0),
    });
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats." });
  }
});

// --- Admin profile & password ---

app.put("/api/admin/profile", requireAuth, async (req, res) => {
  const { full_name } = req.body
  if (!full_name) return res.status(400).json({ error: "Full name is required." })

  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .update({ full_name })
    .eq("user_id", req.user.id)
    .select("*, role:admin_roles(name, label)")
    .single()

  if (error) {
    console.error("Profile update error:", error)
    return res.status(500).json({ error: "Failed to update profile." })
  }
  res.json({ profile: data })
})

app.put("/api/admin/password", authLimiter, requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body
  if (!current_password) return res.status(400).json({ error: "Current password is required." })
  if (!new_password || new_password.length < 8) return res.status(400).json({ error: "New password must be at least 8 characters." })

  const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
    email: req.user.email,
    password: current_password,
  })
  if (signInError) return res.status(403).json({ error: "Current password is incorrect." })

  const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, { password: new_password })
  if (error) {
    console.error("Password update error:", error)
    return res.status(500).json({ error: "Failed to update password." })
  }
  res.json({ ok: true })
})

// --- AI Assistant ---

app.use("/api/ai", aiRoutes);

// --- AI Knowledge ---

app.use("/api/ai-knowledge", aiKnowledgeRoutes);

// --- SPA fallback (production) ---

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("/{*path}", (req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
