import postgres from 'postgres'
import QRCode from 'qrcode'
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas'
import fs from 'node:fs/promises'
import path from 'node:path'

const SITE_URL = 'https://afaq.club'
const QR_DIR = path.resolve('public/qr')
const QR_LABELS = {
  'internship-opportunities': 'INTERNSHIPS',
  'digital-tools-equipment': 'DIGITAL TOOLS',
  'university-transport': 'TRANSPORT',
  'progress-platform': 'PROGRESS PLATFORM',
}
const FONT_PATH = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

const items = [
  {
    slug: 'internship-opportunities',
    icon: 'Users',
    title: {
      en: 'Lack of Internship Opportunities',
      fr: "Le manque d'opportunités de stage",
      ar: 'نقص فرص التربص (التدريب المهني)',
    },
    description: {
      en: 'Students struggle to find internships due to a lack of information about available offers and limited connections with companies. Complicated administrative procedures also slow down this process, making it harder for them to enter the professional world and put their studies into practice.',
      fr: "Les étudiants ont du mal à trouver des stages par manque d'informations sur les offres et de contacts avec les entreprises. Les démarches administratives compliquées ralentissent aussi ce processus, ce qui complique leur entrée dans le monde professionnel et la mise en pratique de leurs études.",
      ar: 'يجد الطلبة صعوبة في العثور على تربصات بسبب نقص المعلومات حول العروض المتاحة وقلة التواصل مع الشركات. كما تؤدي الإجراءات الإدارية المعقدة إلى إبطاء هذه العملية، مما يصعّب اندماجهم في عالم الشغل وتطبيق معارفهم الدراسية على أرض الواقع.',
    },
    questions: [
      {
        type: 'single',
        prompt: "Quelle est la principale difficulté pour trouver un stage ?",
        required: true,
        options: [
          "Manque d'informations sur les offres",
          'Absence de contacts avec les entreprises',
          'Démarches administratives compliquées',
          'Autre',
        ],
      },
      {
        type: 'multiple',
        prompt: "Quelle aide serait la plus utile pour trouver un stage ?",
        help: 'Plusieurs choix possibles.',
        required: true,
        options: [
          "Une plateforme d'offres de stage",
          'Des partenariats avec des entreprises',
          'Un accompagnement pour les démarches administratives',
          'Des ateliers CV et entretiens',
        ],
      },
      {
        type: 'rating',
        prompt: 'À quel point la recherche de stage est-elle difficile ?',
        required: true,
        scale_max: 5,
      },
    ],
  },
  {
    slug: 'digital-tools-equipment',
    icon: 'Plug',
    title: {
      en: 'Lack of Digital Tools and Equipment',
      fr: "Le manque d'outils numériques et d'équipements",
      ar: 'نقص الأدوات الرقمية والتجهيزات',
    },
    description: {
      en: 'University procedures are still slowed down by excessive paperwork and a lack of digital solutions. In addition, a frequently crashing website and a shortage of computers in practical lab rooms (TP) hinder students’ hands-on learning.',
      fr: 'Les démarches universitaires restent ralenties par la paperasserie et un manque de solutions numériques. De plus, un site web qui tombe souvent en panne et le manque de PC dans les salles de TP compliquent l’apprentissage pratique des étudiants.',
      ar: 'لا تزال الإجراءات الجامعية بطيئة بسبب الاعتماد على المعاملات الورقية ونقص الحلول الرقمية. بالإضافة إلى ذلك، فإن الأعطال المتكررة للموقع الإلكتروني للجامعة ونقص أجهزة الكمبيوتر في قاعات الأعمال التطبيقية (TP) يعيقان التعلم التطبيقي للطلبة.',
    },
    questions: [
      {
        type: 'multiple',
        prompt: "Quels outils ou équipements manquent le plus ?",
        help: 'Plusieurs choix possibles.',
        required: true,
        options: [
          'Des ordinateurs dans les salles de TP',
          'Un site web universitaire fiable',
          'Des outils numériques pour les démarches',
          'Une connexion Internet stable',
        ],
      },
      {
        type: 'single',
        prompt: 'Quel problème vous gêne le plus au quotidien ?',
        required: true,
        options: [
          'Les démarches sur papier',
          'Le site web qui tombe souvent en panne',
          'Le manque de PC dans les salles de TP',
          'Autre',
        ],
      },
      {
        type: 'text',
        prompt: 'Quelle solution concrète proposez-vous ?',
        required: false,
      },
    ],
  },
  {
    slug: 'university-transport',
    icon: 'Bus',
    title: {
      en: 'University Transportation Difficulties',
      fr: 'Les difficultés de transport universitaire',
      ar: 'صعوبات النقل الجامعي',
    },
    description: {
      en: 'Student commuting is complicated by the lack of clear bus schedules and a shortage of dedicated university buses. This situation leads to frequent delays and makes daily travel difficult and unpredictable.',
      fr: "Les déplacements des étudiants sont compliqués par l'absence d'affichage clair des horaires de passage et le manque de bus dédiés à l'université. Cette situation entraîne des retards fréquents et rend le trajet quotidien difficile et imprévisible.",
      ar: 'تتعقد تنقلات الطلبة بسبب غياب لوحات واضحة لمواقيت مرور الحافلات ونقص الحافلات المخصصة للجامعة. يؤدي هذا الوضع إلى تأخرات متكررة ويجعل التنقل اليومي صعباً وغير مضمون.',
    },
    questions: [
      {
        type: 'multiple',
        prompt: 'Quel est le plus gros problème de transport universitaire ?',
        help: 'Plusieurs choix possibles.',
        required: true,
        options: [
          "L'absence d'horaires clairs et affichés",
          'Le manque de bus dédiés à l’université',
          'Les retards fréquents',
          'Un trajet long et imprévisible',
        ],
      },
      {
        type: 'single',
        prompt: "Comment vous rendez-vous habituellement à l'université ?",
        required: true,
        options: ['Bus', 'Voiture', 'Transport partagé', 'À pied / autre'],
      },
      {
        type: 'rating',
        prompt: 'À quel point votre trajet quotidien est-il difficile ?',
        required: true,
        scale_max: 5,
      },
    ],
  },
  {
    slug: 'progress-platform',
    icon: 'CalendarDays',
    title: {
      en: 'Improving the Progress Platform',
      fr: "L'amélioration de la plateforme Progress",
      ar: 'تحسين منصة "بروغرس" (Progress)',
    },
    description: {
      en: 'The Progress platform suffers from significant technical delays, with several sections not working or remaining incomplete. This limits its daily usefulness and prevents students from completing all their administrative procedures online efficiently.',
      fr: 'La plateforme Progress accuse un retard technique important, avec plusieurs sections qui ne fonctionnent pas ou restent inachevées. Cette situation limite son utilité au quotidien et empêche les étudiants d’effectuer toutes leurs démarches en ligne efficacement.',
      ar: 'تعاني منصة "بروغرس" من تأخر تقني كبير، حيث إن العديد من أقسامها لا تعمل أو لا تزال غير مكتملة. يحدّ هذا الوضع من فائدتها اليومية ويمنع الطلبة من إتمام جميع إجراءاتهم عبر الإنترنت بفعالية.',
    },
    questions: [
      {
        type: 'multiple',
        prompt: 'Quelles sections de Progress posent le plus de problèmes ?',
        help: 'Plusieurs choix possibles.',
        required: true,
        options: [
          'Inscription / réinscription',
          'Notes et résultats',
          'Emploi du temps',
          'Démarches administratives',
          'Autre',
        ],
      },
      {
        type: 'single',
        prompt: 'Quelle amélioration faut-il prioriser ?',
        required: true,
        options: [
          'Réparer les sections qui ne fonctionnent pas',
          'Terminer les sections inachevées',
          'Rendre la plateforme plus rapide',
          'Améliorer la navigation',
        ],
      },
      {
        type: 'rating',
        prompt: 'Quelle est votre satisfaction globale de Progress ?',
        required: true,
        scale_max: 5,
      },
    ],
  },
]

const TRANSLATIONS = {
  'internship-opportunities': {
    en: {
      title: 'Lack of Internship Opportunities',
      description: items[0].description.en,
      thank_you_message: 'Thank you for your time!',
      questions: [
        {
          prompt: 'What is the main difficulty in finding an internship?',
          options: ['Lack of information about available offers', 'No contacts with companies', 'Complicated administrative procedures', 'Other'],
        },
        {
          prompt: 'What help would be most useful for finding an internship?',
          help: 'Select any.',
          options: ['A platform listing internship offers', 'Partnerships with companies', 'Help with administrative procedures', 'CV and interview workshops'],
        },
        { prompt: 'How difficult is finding an internship?' },
      ],
    },
    ar: {
      title: 'نقص فرص التربص (التدريب المهني)',
      description: items[0].description.ar,
      thank_you_message: 'شكرًا لوقتك!',
      questions: [
        {
          prompt: 'ما هي الصعوبة الرئيسية في العثور على تربص؟',
          options: ['نقص المعلومات عن العروض المتاحة', 'انعدام التواصل مع الشركات', 'الإجراءات الإدارية المعقدة', 'أخرى'],
        },
        {
          prompt: 'ما نوع المساعدة الأكثر فائدة للعثور على تربص؟',
          help: 'يمكنك اختيار أكثر من إجابة.',
          options: ['منصة تعرض عروض التربص', 'شراكات مع الشركات', 'مساعدة في الإجراءات الإدارية', 'ورش عمل للسيرة الذاتية والمقابلات'],
        },
        { prompt: 'إلى أي مدى يصعب العثور على تربص؟' },
      ],
    },
  },
  'digital-tools-equipment': {
    en: {
      title: 'Lack of Digital Tools and Equipment',
      description: items[1].description.en,
      thank_you_message: 'Thank you for your time!',
      questions: [
        {
          prompt: 'Which tools or equipment are most missing?',
          help: 'Select any.',
          options: ['Computers in practical lab rooms (TP)', 'A reliable university website', 'Digital tools for administrative steps', 'A stable internet connection'],
        },
        {
          prompt: 'Which problem bothers you most day to day?',
          options: ['Paperwork', 'The website often crashing', 'The lack of computers in labs', 'Other'],
        },
        { prompt: 'What concrete solution do you suggest?' },
      ],
    },
    ar: {
      title: 'نقص الأدوات الرقمية والتجهيزات',
      description: items[1].description.ar,
      thank_you_message: 'شكرًا لوقتك!',
      questions: [
        {
          prompt: 'ما الأدوات أو التجهيزات الأكثر نقصًا؟',
          help: 'يمكنك اختيار أكثر من إجابة.',
          options: ['أجهزة كمبيوتر في قاعات الأعمال التطبيقية (TP)', 'موقع إلكتروني موثوق للجامعة', 'أدوات رقمية للإجراءات الإدارية', 'اتصال إنترنت مستقر'],
        },
        {
          prompt: 'ما المشكلة التي تزعجك أكثر في يومك؟',
          options: ['المعاملات الورقية', 'الأعطال المتكررة للموقع', 'نقص أجهزة الكمبيوتر في القاعات', 'أخرى'],
        },
        { prompt: 'ما الحل العملي الذي تقترحه؟' },
      ],
    },
  },
  'university-transport': {
    en: {
      title: 'University Transportation Difficulties',
      description: items[2].description.en,
      thank_you_message: 'Thank you for your time!',
      questions: [
        {
          prompt: 'What is the biggest university transport problem?',
          help: 'Select any.',
          options: ['No clear or posted bus schedules', 'Not enough university buses', 'Frequent delays', 'A long and unpredictable commute'],
        },
        {
          prompt: 'How do you usually get to university?',
          options: ['Bus', 'Car', 'Shared transport', 'Walking / other'],
        },
        { prompt: 'How difficult is your daily commute?' },
      ],
    },
    ar: {
      title: 'صعوبات النقل الجامعي',
      description: items[2].description.ar,
      thank_you_message: 'شكرًا لوقتك!',
      questions: [
        {
          prompt: 'ما أكبر مشكلة في النقل الجامعي؟',
          help: 'يمكنك اختيار أكثر من إجابة.',
          options: ['غياب مواقيت واضحة للحافلات', 'نقص الحافلات المخصصة للجامعة', 'تأخرات متكررة', 'تنقل طويل وغير مضمون'],
        },
        {
          prompt: 'كيف تصل عادةً إلى الجامعة؟',
          options: ['الحافلة', 'السيارة', 'نقل مشترك', 'مشي / أخرى'],
        },
        { prompt: 'إلى أي مدى يصعب تنقلك اليومي؟' },
      ],
    },
  },
  'progress-platform': {
    en: {
      title: 'Improving the Progress Platform',
      description: items[3].description.en,
      thank_you_message: 'Thank you for your time!',
      questions: [
        {
          prompt: 'Which Progress sections cause the most problems?',
          help: 'Select any.',
          options: ['Registration / re-registration', 'Grades and results', 'Timetable', 'Administrative procedures', 'Other'],
        },
        {
          prompt: 'What improvement should come first?',
          options: ['Fix sections that do not work', 'Finish incomplete sections', 'Make the platform faster', 'Improve navigation'],
        },
        { prompt: 'How satisfied are you with Progress overall?' },
      ],
    },
    ar: {
      title: 'تحسين منصة "بروغرس" (Progress)',
      description: items[3].description.ar,
      thank_you_message: 'شكرًا لوقتك!',
      questions: [
        {
          prompt: 'ما الأقسام التي تسبب أكبر مشاكل في منصة بروغرس؟',
          help: 'يمكنك اختيار أكثر من إجابة.',
          options: ['التسجيل / إعادة التسجيل', 'الدرجات والنتائج', 'الجدول الزمني', 'الإجراءات الإدارية', 'أخرى'],
        },
        {
          prompt: 'ما التحسين الذي يجب أن يكون أولوية؟',
          options: ['إصلاح الأقسام التي لا تعمل', 'إكمال الأقسام غير المكتملة', 'تسريع المنصة', 'تحسين التنقل'],
        },
        { prompt: 'ما مدى رضاك العام عن منصة بروغرس؟' },
      ],
    },
  },
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 15, ssl: 'require' })

await fs.mkdir(QR_DIR, { recursive: true })

for (const [index, item] of items.entries()) {
  const url = `${SITE_URL}/p/${item.slug}`
  await sql.begin(async tx => {
    let pollRows = await tx`select id from polls where slug = ${item.slug}`
    let pollId

    if (pollRows.length) {
      pollId = pollRows[0].id
      console.log(`Poll already exists: ${item.slug} (#${pollId})`)
    } else {
      const [poll] = await tx`
        insert into polls (slug, title, description, language, audience, status, results_visibility, collect_identity)
        values (
          ${item.slug}, ${item.title.fr}, ${item.description.fr}, 'fr', 'public', 'open', 'after_vote', 'none'
        )
        returning id
      `
      pollId = poll.id

      for (const [qIndex, q] of item.questions.entries()) {
        const [question] = await tx`
          insert into poll_questions (poll_id, position, type, prompt, help, required, scale_max)
          values (
            ${pollId}, ${qIndex}, ${q.type}, ${q.prompt}, ${q.help || null}, ${q.required}, ${q.scale_max || null}
          )
          returning id
        `
        for (const [oIndex, label] of (q.options || []).entries()) {
          await tx`
            insert into poll_options (question_id, position, label)
            values (${question.id}, ${oIndex}, ${label})
          `
        }
      }
      console.log(`Created poll: ${item.slug} (#${pollId})`)
    }

    const [current] = await tx`select translations from polls where id = ${pollId}`
    if (TRANSLATIONS[item.slug] && !Object.keys(current.translations || {}).length) {
      await tx`update polls set translations = ${TRANSLATIONS[item.slug]} where id = ${pollId}`
      console.log(`Translations added: ${item.slug} (en, ar)`)
    }

    const existing = await tx`select id from campus_problems where title_en = ${item.title.en}`
    if (existing.length) {
      await tx`update campus_problems set poll_id = ${pollId} where id = ${existing[0].id}`
      console.log(`Updated problem: ${item.title.en} (#${existing[0].id})`)
    } else {
      const sortOrder = 6 + index
      await tx`
        insert into campus_problems
          (title_en, title_fr, title_ar, description_en, description_fr, description_ar, icon, poll_id, is_active, sort_order)
        values (
          ${item.title.en}, ${item.title.fr}, ${item.title.ar},
          ${item.description.en}, ${item.description.fr}, ${item.description.ar},
          ${item.icon}, ${pollId}, true, ${sortOrder}
        )
      `
      console.log(`Created problem: ${item.title.en} (order ${sortOrder})`)
    }
  })

  const qrBuffer = await QRCode.toBuffer(url, {
    type: 'png',
    width: 640,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#0a1220', light: '#ffffff' },
  })
  const canvas = createCanvas(640, 716)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 640, 716)
  ctx.drawImage(await loadImage(qrBuffer), 0, 0)
  ctx.fillStyle = '#2460e7'
  ctx.fillRect(40, 656, 560, 2)
  try {
    await fs.access(FONT_PATH)
    GlobalFonts.registerFromPath(FONT_PATH, 'QR label')
  } catch {}
  ctx.fillStyle = '#0a1220'
  ctx.font = '700 34px "QR label", Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(QR_LABELS[item.slug], 320, 699)
  const qrFile = path.join(QR_DIR, `${item.slug}.png`)
  await fs.writeFile(qrFile, await canvas.encode('png'))
  console.log(`QR code: /qr/${item.slug}.png -> ${url} (${QR_LABELS[item.slug]})`)
}

await sql.end()
console.log('\nDone. 4 problematics, 4 polls and 4 QR codes are ready.')
