/**
 * Language support for exported documents (PDF and CSV). The console itself
 * is English-only, so pages keep building their headers and rows in English;
 * an export then runs those strings through here to print them in French or
 * Arabic. Anything not in the vocabulary — names, descriptions, free text —
 * is printed exactly as entered.
 */

export const EXPORT_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'ar', label: 'العربية' },
]

const LANGUAGE_KEY = 'afaq.export.lang'

/** The language picked for the last export, so the next one starts there. */
export function savedExportLanguage() {
  try {
    const value = localStorage.getItem(LANGUAGE_KEY)
    return EXPORT_LANGUAGES.some(l => l.value === value) ? value : 'en'
  } catch {
    return 'en'
  }
}

export function rememberExportLanguage(lang) {
  try { localStorage.setItem(LANGUAGE_KEY, lang) } catch { /* storage blocked */ }
}

const LOCALE = { en: 'en-GB', fr: 'fr-FR', ar: 'ar-DZ-u-nu-latn' }

export const isRtl = lang => lang === 'ar'

/** Document chrome. `{n}`-style placeholders are filled by `t`. */
const STRINGS = {
  club: { en: 'AFAQ Scientific Club', fr: 'Club Scientifique AFAQ', ar: 'نادي آفاق العلمي' },
  page: { en: 'Page {n} of {total}', fr: 'Page {n} sur {total}', ar: 'الصفحة {n} من {total}' },
  generated: { en: 'Generated {date}', fr: 'Généré le {date}', ar: 'أُنشئ في {date}' },
  rows: { en: '{n} rows', fr: '{n} lignes', ar: 'عدد الأسطر: {n}' },
  financialReport: { en: 'Financial report', fr: 'Rapport financier', ar: 'التقرير المالي' },
  allTime: { en: 'All time', fr: 'Toute la période', ar: 'كل الفترات' },
  summary: { en: 'Summary', fr: 'Synthèse', ar: 'الملخص' },
  openingBalance: { en: 'Opening balance', fr: 'Solde d’ouverture', ar: 'الرصيد الافتتاحي' },
  totalIncome: { en: 'Total income', fr: 'Total des recettes', ar: 'مجموع الإيرادات' },
  totalExpenses: { en: 'Total expenses', fr: 'Total des dépenses', ar: 'مجموع المصروفات' },
  netResult: { en: 'Net result', fr: 'Résultat net', ar: 'النتيجة الصافية' },
  closingBalance: { en: 'Closing balance', fr: 'Solde de clôture', ar: 'الرصيد الختامي' },
  incomeByCategory: { en: 'Income by category', fr: 'Recettes par catégorie', ar: 'الإيرادات حسب الفئة' },
  expensesByCategory: { en: 'Expenses by category', fr: 'Dépenses par catégorie', ar: 'المصروفات حسب الفئة' },
  category: { en: 'Category', fr: 'Catégorie', ar: 'الفئة' },
  amount: { en: 'Amount', fr: 'Montant', ar: 'المبلغ' },
  share: { en: 'Share', fr: 'Part', ar: 'النسبة' },
  total: { en: 'Total', fr: 'Total', ar: 'المجموع' },
  nothingRecorded: { en: 'Nothing recorded', fr: 'Aucune opération', ar: 'لا شيء مسجّل' },
  budgets: { en: 'Budgets: planned vs actual', fr: 'Budgets : prévu et réalisé', ar: 'الميزانيات: المخطط مقابل الفعلي' },
  budget: { en: 'Budget', fr: 'Budget', ar: 'الميزانية' },
  wholeClub: { en: 'Whole club', fr: 'Tout le club', ar: 'النادي كله' },
  plannedSpend: { en: 'Planned spend', fr: 'Dépenses prévues', ar: 'المصروف المخطط' },
  actualSpend: { en: 'Actual spend', fr: 'Dépenses réelles', ar: 'المصروف الفعلي' },
  remaining: { en: 'Remaining', fr: 'Reste', ar: 'المتبقي' },
  expectedIncome: { en: 'Expected income', fr: 'Recettes prévues', ar: 'الإيراد المتوقع' },
  raised: { en: 'Raised', fr: 'Collecté', ar: 'المحصَّل' },
  transactions: { en: 'Transactions ({n})', fr: 'Opérations ({n})', ar: 'العمليات ({n})' },
  date: { en: 'Date', fr: 'Date', ar: 'التاريخ' },
  description: { en: 'Description', fr: 'Libellé', ar: 'البيان' },
  fromTo: { en: 'From / to', fr: 'De / à', ar: 'من / إلى' },
  ref: { en: 'Ref.', fr: 'Réf.', ar: 'المرجع' },
  noTransactions: { en: 'No transactions in this period', fr: 'Aucune opération sur cette période', ar: 'لا توجد عمليات في هذه الفترة' },
  currencyNote: { en: 'Amounts in Algerian dinars (DA)', fr: 'Montants en dinars algériens (DA)', ar: 'المبالغ بالدينار الجزائري (دج)' },
  treasurer: { en: 'Treasurer', fr: 'Trésorier', ar: 'أمين المال' },
  president: { en: 'President', fr: 'Président', ar: 'الرئيس' },
  signatureLine: {
    en: '{role} — name, signature and date',
    fr: '{role} — nom, signature et date',
    ar: '{role} — الاسم والتوقيع والتاريخ',
  },
}

export function t(lang, key, vars = {}) {
  const entry = STRINGS[key]
  const text = entry?.[lang] ?? entry?.en ?? key
  return text.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ''))
}

/**
 * Column headers, filter names and enumerated values as the pages print them
 * — both the raw database value (`in_progress`) and its label ("In progress")
 * — keyed in lower case. The English column tidies raw values up too.
 */
const TERMS = [
  // Column headers.
  ['name', 'Name', 'Nom', 'الاسم'],
  ['email', 'Email', 'E-mail', 'البريد الإلكتروني'],
  ['phone', 'Phone', 'Téléphone', 'الهاتف'],
  ['role', 'Role', 'Rôle', 'الدور'],
  ['roles', 'Roles', 'Rôles', 'المهام'],
  ['access', 'Access', 'Accès', 'الوصول'],
  ['added', 'Added', 'Ajouté le', 'تاريخ الإضافة'],
  ['title', 'Title', 'Titre', 'العنوان'],
  ['category', 'Category', 'Catégorie', 'الفئة'],
  ['keywords', 'Keywords', 'Mots-clés', 'الكلمات المفتاحية'],
  ['status', 'Status', 'Statut', 'الحالة'],
  ['updated', 'Updated', 'Mis à jour', 'آخر تحديث'],
  ['student id', 'Student ID', 'Matricule', 'رقم الطالب'],
  ['department', 'Department', 'Département', 'القسم'],
  ['study year', 'Study year', 'Année d’études', 'السنة الدراسية'],
  ['skills', 'Skills', 'Compétences', 'المهارات'],
  ['interests', 'Interests', 'Centres d’intérêt', 'الاهتمامات'],
  ['motivation', 'Motivation', 'Motivation', 'الدافع'],
  ['applied', 'Applied', 'Candidature le', 'تاريخ التقديم'],
  ['item', 'Item', 'Article', 'العنصر'],
  ['asset code', 'Asset code', 'Code inventaire', 'رمز العتاد'],
  ['borrower', 'Borrower', 'Emprunteur', 'المستعير'],
  ['checked out', 'Checked out', 'Emprunté le', 'تاريخ الإعارة'],
  ['due', 'Due', 'Échéance', 'موعد الإرجاع'],
  ['returned', 'Returned', 'Rendu', 'أُعيد'],
  ['date', 'Date', 'Date', 'التاريخ'],
  ['time', 'Time', 'Heure', 'الوقت'],
  ['seats taken', 'Seats taken', 'Places prises', 'المقاعد المحجوزة'],
  ['capacity', 'Capacity', 'Capacité', 'السعة'],
  ['registration', 'Registration', 'Inscriptions', 'التسجيل'],
  ['visibility', 'Visibility', 'Visibilité', 'الظهور'],
  ['kind', 'Kind', 'Type', 'النوع'],
  ['description', 'Description', 'Libellé', 'البيان'],
  ['from / to', 'From / to', 'De / à', 'من / إلى'],
  ['event / project', 'Event / project', 'Événement / projet', 'الحدث / المشروع'],
  ['method', 'Method', 'Moyen de paiement', 'طريقة الدفع'],
  ['reference', 'Reference', 'Référence', 'المرجع'],
  ['amount (da)', 'Amount (DA)', 'Montant (DA)', 'المبلغ (دج)'],
  ['serial', 'Serial', 'N° de série', 'الرقم التسلسلي'],
  ['condition', 'Condition', 'État', 'الحالة الفنية'],
  ['location', 'Location', 'Emplacement', 'الموقع'],
  ['member code', 'Member code', 'Code membre', 'رمز العضو'],
  ['team', 'Team', 'Équipe', 'الفريق'],
  ['card', 'Card', 'Carte', 'البطاقة'],
  ['joined', 'Joined', 'Adhésion', 'تاريخ الانضمام'],
  ['left', 'Left', 'Départ', 'تاريخ المغادرة'],
  ['subject', 'Subject', 'Objet', 'الموضوع'],
  ['message', 'Message', 'Message', 'الرسالة'],
  ['received', 'Received', 'Reçu le', 'تاريخ الاستلام'],
  ['technologies', 'Technologies', 'Technologies', 'التقنيات'],
  ['repository', 'Repository', 'Dépôt', 'المستودع'],
  ['demo', 'Demo', 'Démo', 'العرض'],
  ['created', 'Created', 'Créé le', 'تاريخ الإنشاء'],
  ['event', 'Event', 'Événement', 'الحدث'],
  ['registered', 'Registered', 'Inscrit le', 'تاريخ التسجيل'],
  ['task', 'Task', 'Tâche', 'المهمة'],
  ['assigned to', 'Assigned to', 'Assignée à', 'مسندة إلى'],
  ['project', 'Project', 'Projet', 'المشروع'],
  ['priority', 'Priority', 'Priorité', 'الأولوية'],
  ['completed', 'Completed', 'Terminée le', 'تاريخ الإنجاز'],

  // Document titles.
  ['admins', 'Admins', 'Administrateurs', 'المشرفون'],
  ['ai knowledge', 'AI knowledge', 'Base de connaissances IA', 'قاعدة معارف الذكاء الاصطناعي'],
  ['applications', 'Applications', 'Candidatures', 'طلبات الانضمام'],
  ['borrowing history', 'Borrowing history', 'Historique des emprunts', 'سجل الإعارات'],
  ['events', 'Events', 'Événements', 'الفعاليات'],
  ['finance ledger', 'Finance ledger', 'Journal des opérations', 'السجل المالي'],
  ['inventory', 'Inventory', 'Inventaire', 'الجرد'],
  ['members', 'Members', 'Membres', 'الأعضاء'],
  ['messages', 'Messages', 'Messages', 'الرسائل'],
  ['projects', 'Projects', 'Projets', 'المشاريع'],
  ['event registrations', 'Event registrations', 'Inscriptions aux événements', 'التسجيلات في الفعاليات'],
  ['tasks', 'Tasks', 'Tâches', 'المهام'],

  // Filters and statuses.
  ['all', 'All', 'Tous', 'الكل'],
  ['active', 'Active', 'Actif', 'نشط'],
  ['inactive', 'Inactive', 'Inactif', 'غير نشط'],
  ['alumni', 'Alumni', 'Ancien membre', 'عضو سابق'],
  ['suspended', 'Suspended', 'Suspendu', 'موقوف'],
  ['lost', 'Lost', 'Perdue', 'مفقودة'],
  ['pending', 'Pending', 'En attente', 'قيد الانتظار'],
  ['approved', 'Approved', 'Accepté', 'مقبول'],
  ['rejected', 'Rejected', 'Refusé', 'مرفوض'],
  ['published', 'Published', 'Publié', 'منشور'],
  ['draft', 'Draft', 'Brouillon', 'مسودة'],
  ['open', 'Open', 'Ouvertes', 'مفتوح'],
  ['closed', 'Closed', 'Fermées', 'مغلق'],
  ['upcoming', 'Upcoming', 'À venir', 'قادمة'],
  ['past', 'Past', 'Passés', 'سابقة'],
  ['read', 'Read', 'Lu', 'مقروءة'],
  ['unread', 'Unread', 'Non lu', 'غير مقروءة'],
  ['available', 'Available', 'Disponible', 'متاح'],
  ['borrowed', 'Borrowed', 'Emprunté', 'مُعار'],
  ['repair', 'In repair', 'En réparation', 'قيد الإصلاح'],
  ['in repair', 'In repair', 'En réparation', 'قيد الإصلاح'],
  ['retired', 'Retired', 'Réformé', 'خارج الخدمة'],
  ['overdue', 'Overdue', 'En retard', 'متأخر'],
  ['todo', 'To do', 'À faire', 'للإنجاز'],
  ['to do', 'To do', 'À faire', 'للإنجاز'],
  ['in_progress', 'In progress', 'En cours', 'قيد الإنجاز'],
  ['in progress', 'In progress', 'En cours', 'قيد الإنجاز'],
  ['done', 'Done', 'Terminée', 'منجزة'],
  ['cancelled', 'Cancelled', 'Annulée', 'ملغاة'],
  ['low', 'Low', 'Basse', 'منخفضة'],
  ['normal', 'Normal', 'Normale', 'عادية'],
  ['high', 'High', 'Haute', 'عالية'],
  ['new', 'New', 'Neuf', 'جديد'],
  ['good', 'Good', 'Bon', 'جيد'],
  ['worn', 'Worn', 'Usé', 'مستهلك'],
  ['damaged', 'Damaged', 'Endommagé', 'تالف'],

  // Inventory categories.
  ['electronics', 'Electronics', 'Électronique', 'إلكترونيات'],
  ['tools', 'Tools', 'Outils', 'أدوات'],
  ['lab equipment', 'Lab equipment', 'Matériel de laboratoire', 'معدات المخبر'],
  ['furniture', 'Furniture', 'Mobilier', 'أثاث'],
  ['consumables', 'Consumables', 'Consommables', 'مستهلكات'],
  ['other', 'Other', 'Autre', 'أخرى'],

  // Finance.
  ['income', 'Income', 'Recette', 'إيراد'],
  ['expense', 'Expense', 'Dépense', 'مصروف'],
  ['sponsorship', 'Sponsorship', 'Sponsoring', 'رعاية'],
  ['donation', 'Donation', 'Don', 'تبرع'],
  ['grant / subsidy', 'Grant / subsidy', 'Subvention', 'منحة / إعانة'],
  ['event revenue', 'Event revenue', 'Recettes d’événement', 'مداخيل الفعاليات'],
  ['other income', 'Other income', 'Autres recettes', 'إيرادات أخرى'],
  ['event cost', 'Event cost', 'Frais d’événement', 'تكاليف الفعاليات'],
  ['equipment purchase', 'Equipment purchase', 'Achat de matériel', 'شراء معدات'],
  ['supplies & components', 'Supplies & components', 'Fournitures et composants', 'لوازم ومكونات'],
  ['printing & merch', 'Printing & merch', 'Impression et goodies', 'طباعة ومنتجات دعائية'],
  ['transport', 'Transport', 'Transport', 'نقل'],
  ['food & catering', 'Food & catering', 'Restauration', 'إطعام'],
  ['fees & subscriptions', 'Fees & subscriptions', 'Frais et abonnements', 'رسوم واشتراكات'],
  ['other expense', 'Other expense', 'Autres dépenses', 'مصروفات أخرى'],
  ['cash', 'Cash', 'Espèces', 'نقدًا'],
  ['bank transfer', 'Bank transfer', 'Virement bancaire', 'تحويل بنكي'],
  ['ccp / baridimob', 'CCP / BaridiMob', 'CCP / BaridiMob', 'CCP / بريدي موب'],
  ['cheque', 'Cheque', 'Chèque', 'صك'],
  ['this month', 'This month', 'Ce mois-ci', 'هذا الشهر'],
  ['last month', 'Last month', 'Le mois dernier', 'الشهر الماضي'],
  ['this season', 'This season', 'Cette saison', 'هذا الموسم'],
  ['this year', 'This year', 'Cette année', 'هذه السنة'],
  ['all time', 'All time', 'Toute la période', 'كل الفترات'],
]

const COLUMN = { en: 1, fr: 2, ar: 3 }
const DICTIONARY = new Map(TERMS.map(row => [row[0], row]))

/** A header, filter or enumerated value in `lang`; anything unknown comes back unchanged. */
export function term(lang, value) {
  if (value === null || value === undefined || value === '') return value
  const row = DICTIONARY.get(String(value).trim().toLowerCase())
  return row ? row[COLUMN[lang] || 1] : value
}

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 }
const EN_DATE = /^(\d{1,2}) ([A-Za-z]{3,4}) (\d{4})(?:,? (\d{2}):(\d{2}))?$/

/** A `Date` or ISO string as a date (and time) in the document's language. */
export function formatDateFor(lang, value, { time = false } = {}) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(LOCALE[lang] || LOCALE.en, {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(time ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).format(d).replace(/ /g, ' ')
}

/**
 * Re-print a date the console already formatted (`formatDate`/`formatDateTime`,
 * e.g. "12 Mar 2026, 14:30") in `lang`. Other text is returned as is.
 */
export function relocalizeDate(lang, text) {
  if (lang === 'en' || typeof text !== 'string') return text
  const m = EN_DATE.exec(text.trim())
  if (!m) return text
  const month = MONTHS[m[2].toLowerCase()]
  if (month === undefined) return text
  const d = new Date(Number(m[3]), month, Number(m[1]), Number(m[4] || 0), Number(m[5] || 0))
  return formatDateFor(lang, d, { time: m[4] !== undefined })
}

/**
 * Free-standing labels such as a subtitle ("Pending · 12 Mar 2026, 14:30"):
 * each `·`-separated part is translated if it is a known term or a date.
 */
export function localizeLabel(lang, text) {
  if (lang === 'en' || !text) return text
  return String(text).split(' · ').map(part => relocalizeDate(lang, term(lang, part))).join(' · ')
}

const NUMBER = {
  en: new Intl.NumberFormat('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
  fr: new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
  // Arabic keeps Latin digits and a comma separator: a space between digit
  // groups would let the right-to-left layout split one number in two.
  ar: new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
}

/**
 * Money for a document: `1 250 DA` in English and French; in Arabic the bare
 * number, with the currency stated once in the headers, so each amount stays
 * a single left-to-right run inside right-to-left text.
 */
export function moneyFor(lang, value, { signed = false } = {}) {
  const n = Number(value) || 0
  const sign = signed && n > 0 ? '+' : n < 0 ? '-' : ''
  const digits = (NUMBER[lang] || NUMBER.en).format(Math.abs(n)).replace(/[  ]/g, ' ')
  return lang === 'ar' ? `${sign}${digits}` : `${sign}${digits} DA`
}
