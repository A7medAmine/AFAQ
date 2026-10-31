// Seeds the website assistant's knowledge base (ai_knowledge) with articles
// about the club. Sources: the site's own copy, the club's Instagram posts
// (Feb 2025 – Oct 2026) and its LinkedIn page. Re-running updates articles in
// place by slug, so edits made here win over edits made in the admin.
//
//   node scripts/seed-ai-knowledge.mjs
import 'dotenv/config'
import { supabaseAdmin } from '../server/db/client.js'

function slugify(text) {
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

const ARTICLES = [
  {
    title: 'What is AFAQ Scientific Club',
    category: 'About',
    keywords: ['about', 'who are you', 'what is afaq', 'club', 'آفاق', 'نادي', 'من نحن', 'qui sommes-nous', 'club scientifique'],
    content: `AFAQ Scientific Club (نادي آفاق العلمي) is a student club at Akli Mohand Oulhadj University of Bouira (Université de Bouira), Algeria. It was founded in 2024 by students who wanted a place where technology and creativity meet.

The name comes from the Arabic word "آفاق", which means "horizons": the club's aim is to open new horizons for students. Its slogan is "Learn, Innovate, Impact".

AFAQ helps students learn, grow and develop beyond the classroom through workshops, training sessions, competitions, seminars and team projects. It works on both hard skills (electronics, Arduino, robotics, programming) and soft skills (public speaking, languages, teamwork).

The club's logo is a lightning bolt breaking through a circle: energy, electronics and the horizon the club opens.`,
  },
  {
    title: 'Mission, vision and values',
    category: 'About',
    keywords: ['mission', 'vision', 'values', 'goal', 'رؤية', 'رسالة', 'قيم', 'objectif', 'valeurs'],
    content: `Mission: give students practical skills in technology and electronics, encourage innovation and teamwork, and build a lively community of future engineers and creators.

Vision: create horizons for students by helping them build and improve both their hard skills and their soft skills, and become a leading student club that inspires innovation.

Values:
- Innovation: creative thinking and new solutions.
- Teamwork: collaboration and shared knowledge.
- Excellence: doing things well.
- Integrity: honesty, transparency and respect.

The club is open to students of every level, from complete beginners to experienced makers.`,
  },
  {
    title: 'The two sides of AFAQ: Tech Lab and Language Lab',
    category: 'Activities',
    keywords: ['activities', 'what do you do', 'tech', 'languages', 'english', 'sub-clubs', 'أنشطة', 'لغات', 'activités'],
    content: `AFAQ is one club with two sides.

Tech Lab ("We build"): electronics, Arduino, ESP32/ESP8266, robotics, IoT and software. Members learn by making real things together: workshops, robotics challenges and club projects such as the ESP Racer game, the ESP Game Boy console and a PS4-controlled robot car (see the Projects page).

Language Lab ("We speak"): led by members with strong English. It helps students speak with confidence, write CVs, emails and reports, present their work, and prepare to study, travel or work abroad. Its main activity is the "Chill & Chat" speaking club. It is open to every student, from first words to fluent.

The club also takes part in university events such as open days, Student Day, book fairs, seminars and Global Entrepreneurship Week.`,
  },
  {
    title: 'How to join AFAQ',
    category: 'Membership',
    keywords: ['join', 'membership', 'register', 'sign up', 'apply', 'become a member', 'انضمام', 'التسجيل', 'عضوية', 'rejoindre', 'adhésion', 'inscription'],
    content: `To join AFAQ, fill in the membership application on the website's Join page (/join). The form asks for your full name, email, phone, student ID, faculty or department, study year, areas of interest (robotics, programming, electronics, IoT, AI, web development), skills and why you want to join.

Who can join: students of the University of Bouira from any faculty or institute and any study year. You do not need prior experience; the club welcomes beginners.

What happens next: a club admin reviews every application and replies to the email you gave. In past rounds, applicants received a short follow-up questionnaire or an interview invitation by email, so check your inbox and your spam folder.

Membership opens in rounds. If the Join page says applications are closed, follow the club on Instagram (@afaq_scientific_club) or Facebook (AFAQ CLUB) for the next round. Open Days at the start of each year are the best moment to meet the team and ask questions in person.`,
  },
  {
    title: 'Member benefits',
    category: 'Membership',
    keywords: ['benefits', 'perks', 'discount', 'member card', 'member pass', 'why join', 'مزايا', 'تخفيض', 'avantages', 'réduction'],
    content: `What you get as an AFAQ member:
- Hands-on workshops (Arduino, electronics, programming) and training sessions.
- Places in club competitions such as the Robotic Arduino Challenge, and support to take part in university and national events.
- The chance to build real projects with a team and see them published on the club website.
- Language and soft-skills sessions (Chill & Chat, public speaking, writing and presenting).
- A member card with a QR code (member pass).
- Partner discount: since May 2026, AFAQ members get 25% off all courses at Mahdi Education Center (@mahdi_education_center). Show your member pass at the center to use it.
- A friendly community and a network of students from many faculties.`,
  },
  {
    title: 'Chill & Chat speaking club',
    category: 'Activities',
    keywords: ['chill and chat', 'chat & chill', 'speaking', 'english club', 'public speaking', 'conversation', 'نادي المحادثة', 'التحدث', 'anglais', 'parler'],
    content: `Chill & Chat is AFAQ's speaking club, run by the Language Lab. It is a relaxed, beginner-friendly space to practise speaking, share ideas, improve your accent and meet people. No pressure and no judgement.

- First edition: April 2025 (as "Chat & Chill", an English-speaking event).
- Second edition: from March 2026, with different languages, topics and guests, held every 15 days. Sessions in spring 2026 took place at the Faculty of Applied Sciences (ST2), classroom 18, at 13:30.
- A typical session: a guest introduces a meaningful topic, then a fun social game to practise English, with a small gift for the most active participant.
- Highlights: guest speaker Miss Ahlem led sessions on public speaking, including an impromptu-talk challenge (14 April 2026); in session 5 (23 April 2026) participants wrote letters to their past and future selves.

Places are limited. To reserve a spot, send your details to the club in a direct message on Instagram (@afaq_scientific_club). Check the Events page and Instagram for the next session's date.`,
  },
  {
    title: 'Robotic Arduino Challenge (RACE)',
    category: 'Events',
    keywords: ['race', 'robotic arduino challenge', 'competition', 'robot', 'challenge', 'مسابقة', 'روبوت', 'compétition'],
    content: `The Robotic Arduino Challenge (RACE) is AFAQ's robotics competition. Its motto: "Build. Code. Compete." Teams build a machine, code its brain and race for the title.

The first edition took place in mid-April 2026 (announced on 12 April, recap published 17–22 April 2026). It was a day of engineering, speed and teamwork, with a real competitive spirit among the participants.

Future editions are announced on the Events page and on the club's Instagram. To prepare, learn the Arduino basics (digital and analog pins, motors and motor drivers, sensors) and practise with a small robot car.`,
  },
  {
    title: 'Arduino workshops',
    category: 'Events',
    keywords: ['arduino', 'workshop', 'training', 'electronics', 'embeddz', 'ورشة', 'أردوينو', 'formation', 'atelier'],
    content: `Arduino workshops are AFAQ's most regular tech activity. They start with the fundamentals (key concepts, programming basics, circuit design) and then move to hands-on practice.

Past workshops:
- 26–27 February 2025: two-day Arduino workshop in collaboration with Embeddz.com, at the Faculty of Applied Sciences (FSA), amphitheatre 3, ST2. Registration was required and places were limited.
- October 2025: Arduino workshop during the club's return in the new academic year.
- November 2025: Arduino workshop afternoon with a trainer, praised for its clear explanations and practice.

New workshops are posted on the Events page with a registration form when places open. The club also shares short posts about the basic electronic components every beginner should master.`,
  },
  {
    title: 'History of AFAQ events',
    category: 'Events',
    keywords: ['past events', 'history', 'what have you done', 'previous events', 'الفعاليات السابقة', 'événements passés'],
    content: `Main AFAQ events so far, most recent first:

- 11 October 2026: Open Day for the new academic year — discover the club, its sub-clubs and upcoming projects, and meet the team. The club announced "We're back" on 6–8 October 2026.
- 31 May 2026 (recap): Student Day — the club ran a stand.
- April–May 2026: Chill & Chat second edition sessions with guest Miss Ahlem (public speaking, letters to past and future selves).
- April 2026: Robotic Arduino Challenge (RACE).
- March 2026: Chill & Chat returns, every 15 days.
- Early December 2025 (day 1 on 6 December): 1st National Seminar on Process Engineering, organised by AFAQ — two days of talks with students, professors and guests.
- Early December 2025: AFAQ took part in CIMA-2.
- 18 November 2025: kick-off of Global Entrepreneurship Week, with the university rector, vice-rector and the CDE team, and other clubs (Young Scientists Club Bouira, Tech Club, Ennahdha Club).
- November 2025: Arduino workshop.
- Early November 2025: the club at the Book Fair.
- Late October 2025: Arduino workshop and a recruitment call for new members.
- 20 October 2025: Open Day, with support from CLS Bouira.
- April 2025: first "Chat & Chill" English-speaking event.
- 13 March 2025: International Mathematics Day / Pi Day — math talk, quizzes, games and prizes, reading room 3, ST2.
- 26–27 February 2025: two-day Arduino workshop with Embeddz.com, FSA amphitheatre 3.
- 18 February 2025: Open Day and opening of membership registration.

Upcoming events are always listed on the Events page (/events).`,
  },
  {
    title: '1st National Seminar on Process Engineering',
    category: 'Events',
    keywords: ['seminar', 'process engineering', 'national seminar', 'conference', 'ملتقى', 'هندسة الطرائق', 'séminaire', 'génie des procédés'],
    content: `In early December 2025 (day 1 on 6 December), AFAQ organised the 1st National Seminar on Process Engineering at the University of Bouira. Over two days it brought together students, professors and guests for scientific talks, discussions and networking. The club thanked the speakers, participants, university staff and students who made the first edition a success, and plans further editions.`,
  },
  {
    title: 'Partners and collaborations',
    category: 'About',
    keywords: ['partners', 'sponsors', 'collaboration', 'شركاء', 'partenaires', 'mahdi', 'embeddz', 'cls'],
    content: `Organisations AFAQ has worked with:
- Mahdi Education Center: partner since 2026. AFAQ members get 25% off all its courses with their member pass.
- Embeddz.com: co-organised the February 2025 Arduino workshop.
- CLS Bouira: supported the October 2025 Open Day.
- The University of Bouira, including the rector's office and the CDE, who supported events such as Global Entrepreneurship Week 2025.
- Other student clubs at the university, such as Young Scientists Club Bouira, Tech Club and Ennahdha Club.

Organisations interested in partnering with the club can write through the Contact page or by email to afaq.club@univ-bouira.dz.`,
  },
  {
    title: 'Contact and social media',
    category: 'Contact',
    keywords: ['contact', 'email', 'instagram', 'facebook', 'tiktok', 'linkedin', 'social media', 'reach', 'تواصل', 'بريد', 'contacter', 'réseaux sociaux'],
    content: `How to reach AFAQ:
- Email: afaq.club@univ-bouira.dz
- Contact form: the Contact page on the website (/contact). The team reads every message and usually replies within a few days.
- Instagram: @afaq_scientific_club (most active; DMs are used to reserve spots for some activities) — https://www.instagram.com/afaq_scientific_club/
- Facebook: AFAQ CLUB — https://www.facebook.com/profile.php?id=61568388817184
- TikTok: @afaq.club — https://www.tiktok.com/@afaq.club
- LinkedIn: AFAQ Scientific Club — https://www.linkedin.com/company/afaq-scientific-club/
- Location: Akli Mohand Oulhadj University, Bouira, Algeria. Many activities take place at the Faculty of Applied Sciences (ST2 campus).`,
  },
  {
    title: 'Getting started with electronics and Arduino',
    category: 'Learning',
    keywords: ['beginner', 'start', 'learn arduino', 'electronics basics', 'components', 'roadmap', 'مبتدئ', 'تعلم', 'débutant', 'apprendre'],
    content: `A beginner path the club recommends:
1. Learn the basic components: resistor, LED, button, capacitor, diode, transistor, potentiometer, breadboard and jumper wires. Understand voltage, current and Ohm's law (V = R × I).
2. Get an Arduino Uno (or a compatible board) and install the Arduino IDE. Start with "Blink", then read a button, then fade an LED with PWM.
3. Add sensors: temperature, light (LDR), ultrasonic distance (HC-SR04), accelerometer.
4. Move things: servo motors, DC motors with a motor driver (L298N or similar), then a small robot car.
5. Go wireless: ESP32 or ESP8266 for Wi-Fi and Bluetooth projects — the club's ESP Racer, ESP Game Boy and robot car projects are built this way.
6. Build a small project of your own and document it.

The easiest way to progress is to come to AFAQ's Arduino workshops and join a project team, where members help each other.`,
  },
  {
    title: 'Tips for public speaking and practising a language',
    category: 'Learning',
    keywords: ['public speaking', 'confidence', 'english practice', 'presentation', 'التحدث أمام الجمهور', 'prise de parole'],
    content: `Advice shared in AFAQ's Language Lab and Chill & Chat sessions:
- Speak early and often. Mistakes are part of learning; the sessions are made for that.
- Practise short impromptu talks: pick a topic and speak for one minute without notes.
- Prepare presentations around one clear message, a simple structure (start, three points, conclusion) and a story or example.
- Work on eye contact, pace and pauses as much as on words — public speaking is about connection.
- To improve your accent and vocabulary, listen to films, music and podcasts in the language and repeat phrases out loud.
- For CVs, emails and reports, ask experienced members to review your text.

Chill & Chat sessions are the place to practise this in a friendly group.`,
  },
  {
    title: 'Club projects and how to take part',
    category: 'Projects',
    keywords: ['projects', 'build', 'esp racer', 'game boy', 'robot car', 'مشاريع', 'projets'],
    content: `AFAQ members build real projects in teams, mostly in embedded systems and robotics. Published projects are on the Projects page (/projects), with descriptions, technologies and source code links. Examples include the ESP Racer (a browser 3D racing game driven by a tilt controller built on an ESP8266, made for AFAQ Open Week), the ESP Game Boy (a pocket console on an ESP32) and a four-wheel robot car driven with a PS4 controller over Bluetooth.

Members can join an existing project team or propose a new idea to the club's project managers. Beginners are welcome: projects are also a way to learn.`,
  },
]

const now = new Date().toISOString()
const rows = ARTICLES.map(a => ({ ...a, slug: slugify(a.title), published: true, updated_at: now }))

const { data, error } = await supabaseAdmin
  .from('ai_knowledge')
  .upsert(rows, { onConflict: 'slug' })
  .select('id, title')

if (error) {
  console.error('Seeding failed:', error.message)
  process.exit(1)
}
console.log(`Saved ${data.length} articles:`)
for (const row of data) console.log(`  #${row.id} ${row.title}`)
