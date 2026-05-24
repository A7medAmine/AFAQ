import { Router } from 'express'
import { getAllClubInfo, createClubInfo, updateClubInfo, deleteClubInfo } from '../repositories/clubInfoRepository.js'

const router = Router()

const DEFAULTS = [
  { key: 'club_name', labelEn: 'Club Name', labelAr: 'اسم النادي', labelFr: 'Nom du club', valueEn: 'AFAQ Scientific Club', valueAr: 'نادي آفاق العلمي', valueFr: 'Club Scientifique AFAQ', category: 'general', sortOrder: 1 },
  { key: 'club_full_name', labelEn: 'Full Name', labelAr: 'الاسم الكامل', labelFr: 'Nom complet', valueEn: 'AFAQ Scientific Club - University of Akli Mohand Oulhadj', valueAr: 'نادي آفاق العلمي - جامعة آكلي محند أولحاج', valueFr: 'Club Scientifique AFAQ - Université Akli Mohand Oulhadj', category: 'general', sortOrder: 2 },
  { key: 'university', labelEn: 'University', labelAr: 'الجامعة', labelFr: 'Université', valueEn: 'University of Akli Mohand Oulhadj, Bouira, Algeria', valueAr: 'جامعة آكلي محند أولحاج، البويرة، الجزائر', valueFr: 'Université Akli Mohand Oulhadj, Bouira, Algérie', category: 'general', sortOrder: 3 },
  { key: 'mission', labelEn: 'Mission', labelAr: 'الرسالة', labelFr: 'Mission', valueEn: 'To promote scientific culture and innovation among university students through workshops, events, and collaborative projects.', valueAr: 'تعزيز الثقافة العلمية والابتكار بين طلاب الجامعة من خلال ورش العمل والفعاليات والمشاريع التعاونية.', valueFr: 'Promouvoir la culture scientifique et l\'innovation parmi les étudiants universitaires à travers des ateliers, des événements et des projets collaboratifs.', category: 'about', sortOrder: 4 },
  { key: 'vision', labelEn: 'Vision', labelAr: 'الرؤية', labelFr: 'Vision', valueEn: 'To be a leading scientific club that inspires creativity, critical thinking, and scientific excellence in the academic community.', valueAr: 'أن نكون نادياً علمياً رائداً يلهم الإبداع والتفكير النقدي والتميز العلمي في المجتمع الأكاديمي.', valueFr: 'Devenir un club scientifique de premier plan qui inspire la créativité, la pensée critique et l\'excellence scientifique dans la communauté académique.', category: 'about', sortOrder: 5 },
  { key: 'how_to_join', labelEn: 'How to Join', labelAr: 'كيفية الانضمام', labelFr: 'Comment adhérer', valueEn: 'To join AFAQ Scientific Club, visit the Join Us page on the website, fill out the membership form with your name, email, phone, and field of study, and submit. The club will review your application and contact you.', valueAr: 'للانضمام إلى نادي آفاق العلمي، قم بزيارة صفحة "انضم إلينا" على الموقع، واملأ نموذج العضوية باسمك وبريدك الإلكتروني وهاتفك وتخصصك، ثم أرسله. سيقوم النادي بمراجعة طلبك والاتصال بك.', valueFr: 'Pour rejoindre le Club Scientifique AFAQ, visitez la page Rejoignez-nous sur le site, remplissez le formulaire d\'adhésion avec votre nom, email, téléphone et domaine d\'études, puis soumettez-le. Le club examinera votre candidature et vous contactera.', category: 'membership', sortOrder: 6 },
  { key: 'membership_benefits', labelEn: 'Membership Benefits', labelAr: 'مزايا العضوية', labelFr: 'Avantages de l\'adhésion', valueEn: 'Members get access to exclusive workshops, networking events, project collaboration opportunities, mentorship from senior students and professors, and a certificate of participation in club activities.', valueAr: 'يحصل الأعضاء على فرصة حضور ورش العمل الحصرية، وفعاليات التواصل، وفرص التعاون في المشاريع، والإرشاد من الطلاب والأساتذة الكبار، وشهادة مشاركة في أنشطة النادي.', valueFr: 'Les membres bénéficient d\'ateliers exclusifs, d\'événements de réseautage, d\'opportunités de collaboration sur des projets, de mentorat par des étudiants seniors et des professeurs, et d\'un certificat de participation aux activités du club.', category: 'membership', sortOrder: 7 },
  { key: 'how_to_register_events', labelEn: 'How to Register for Events', labelAr: 'كيفية التسجيل في الفعاليات', labelFr: 'Comment s\'inscrire aux événements', valueEn: 'Browse the Events page on the website, find an event you are interested in, and click the "Register" button on the event card. Fill in the required details (name, email, phone) and submit. You will receive a confirmation.', valueAr: 'تصفح صفحة الفعاليات على الموقع، ابحث عن فعالية تهمك، وانقر على زر "تسجيل" في بطاقة الفعالية. املأ البيانات المطلوبة (الاسم، البريد الإلكتروني، الهاتف) وأرسلها. ستتلقى تأكيداً.', valueFr: 'Parcourez la page Événements sur le site, trouvez un événement qui vous intéresse et cliquez sur le bouton "S\'inscrire" sur la carte de l\'événement. Remplissez les informations requises (nom, email, téléphone) et soumettez. Vous recevrez une confirmation.', category: 'events', sortOrder: 8 },
  { key: 'contact_info', labelEn: 'Contact Information', labelAr: 'معلومات الاتصال', labelFr: 'Informations de contact', valueEn: 'You can contact AFAQ Scientific Club using the contact form on the website, or by visiting the club office at the university.', valueAr: 'يمكنك الاتصال بنادي آفاق العلمي باستخدام نموذج الاتصال على الموقع، أو بزيارة مكتب النادي في الجامعة.', valueFr: 'Vous pouvez contacter le Club Scientifique AFAQ via le formulaire de contact sur le site, ou en visitant le bureau du club à l\'université.', category: 'general', sortOrder: 9 },
  { key: 'project_submission', labelEn: 'How to Submit a Project', labelAr: 'كيفية تقديم مشروع', labelFr: 'Comment soumettre un projet', valueEn: 'Projects are managed by the club administration. Contact us through the website form or visit the club directly to discuss your project idea.', valueAr: 'تتم إدارة المشاريع من قبل إدارة النادي. اتصل بنا عبر نموذج الموقع أو قم بزيارة النادي مباشرة لمناقشة فكرة مشروعك.', valueFr: 'Les projets sont gérés par l\'administration du club. Contactez-nous via le formulaire du site ou visitez directement le club pour discuter de votre idée de projet.', category: 'projects', sortOrder: 10 },
  { key: 'club_activities', labelEn: 'Club Activities', labelAr: 'أنشطة النادي', labelFr: 'Activités du club', valueEn: 'AFAQ Scientific Club organizes workshops, seminars, scientific competitions, field trips, community service projects, and collaborative events with other clubs and organizations.', valueAr: 'ينظم نادي آفاق العلمي ورش عمل وندوات ومسابقات علمية ورحلات ميدانية ومشاريع خدمة مجتمعية وفعاليات تعاونية مع الأندية والمنظمات الأخرى.', valueFr: 'Le Club Scientifique AFAQ organise des ateliers, des séminaires, des compétitions scientifiques, des sorties sur le terrain, des projets de service communautaire et des événements collaboratifs avec d\'autres clubs et organisations.', category: 'about', sortOrder: 11 },
]

router.get('/', async (req, res) => {
  try {
    const info = await getAllClubInfo()
    res.json(info)
  } catch (error) {
    console.error('Get club info error:', error)
    res.status(500).json({ error: 'Failed to fetch club info' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { key, labelEn, labelAr, labelFr, valueEn, valueAr, valueFr, category, sortOrder } = req.body
    if (!key || !labelEn || !valueEn) {
      return res.status(400).json({ error: 'key, labelEn, and valueEn are required' })
    }
    const result = await createClubInfo({
      key, labelEn, labelAr, labelFr, valueEn, valueAr, valueFr, category, sortOrder: sortOrder ?? 0,
    })
    res.json(result)
  } catch (error) {
    console.error('Create club info error:', error)
    res.status(500).json({ error: 'Failed to create club info' })
  }
})

router.post('/seed', async (req, res) => {
  try {
    const existing = await getAllClubInfo()
    const existingKeys = new Set(existing.map(e => e.key))
    const created = []
    for (const item of DEFAULTS) {
      if (!existingKeys.has(item.key)) {
        const result = await createClubInfo(item)
        created.push(result)
      }
    }
    res.json({ created: created.length, message: `Seeded ${created.length} new entries` })
  } catch (error) {
    console.error('Seed club info error:', error)
    res.status(500).json({ error: 'Failed to seed club info' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await updateClubInfo(Number(id), req.body)
    res.json(result)
  } catch (error) {
    console.error('Update club info error:', error)
    res.status(500).json({ error: 'Failed to update club info' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await deleteClubInfo(Number(req.params.id))
    res.json({ ok: true })
  } catch (error) {
    console.error('Delete club info error:', error)
    res.status(500).json({ error: 'Failed to delete club info' })
  }
})

export default router
