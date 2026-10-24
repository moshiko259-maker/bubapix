// Headings and button texts the owner can change in the admin
// ("Interface texts / טקסטי ממשק", file content/labels.json).
// Each row: [field name, where the text is used, English name, Hebrew name].
// The admin keeps two fields per row: <field>_en and <field>_he.
// An empty field keeps the usual text from src/i18n.
// scripts/labels-fields.js writes the matching admin fields from this table.
module.exports = [
  // Menu
  ["nav_work", [["nav", "work"], ["work", "title"]], "Menu: Projects", "תפריט: פרויקטים"],
  ["nav_services", [["nav", "services"], ["services", "title"]], "Menu: Services", "תפריט: שירותים"],
  ["nav_shop", [["nav", "shop"], ["shop", "title"]], "Menu: Shop", "תפריט: חנות"],
  ["nav_about", [["nav", "about"], ["about", "title"]], "Menu: About", "תפריט: אודות"],
  ["nav_testimonials", [["nav", "testimonials"], ["testimonials", "title"]], "Menu: Testimonials", "תפריט: המלצות"],
  ["nav_contact", [["nav", "contact"], ["contact", "title"]], "Menu: Contact", "תפריט: יצירת קשר"],
  // Homepage
  ["work_heading", [["home", "workTitle"]], "Homepage: gallery heading", "דף הבית: כותרת הגלריה"],
  ["start_project", [["home", "startProject"]], "Homepage: Start a project button", "דף הבית: כפתור התחילו פרויקט"],
  ["showreel", [["home", "showreel"]], "Homepage: Showreel heading", "דף הבית: כותרת השואוריל"],
  ["all_services", [["home", "allServices"]], "Homepage: All services link", "דף הבית: קישור לכל השירותים"],
  ["home_hint", [["home", "hint"]], "Homepage: line at the bottom (how pictures open)", "דף הבית: שורה בתחתית הדף (מה קורה בלחיצה)"],
  ["work_hint", [["work", "hint"]], "Projects page: line at the bottom (how pictures open)", "עמוד פרויקטים: שורה בתחתית הדף (מה קורה בלחיצה)"],
  // Project page
  ["synopsis", [["work", "synopsis"]], "Project: Synopsis heading", "פרויקט: כותרת תקציר"],
  ["creators", [["work", "creators"]], "Project: Words from the creators heading", "פרויקט: כותרת דברי היוצרים"],
  ["behind", [["work", "behind"]], "Project: Behind the scenes heading", "פרויקט: כותרת מאחורי הקלעים"],
  ["gallery", [["work", "gallery"]], "Project: Images heading", "פרויקט: כותרת תמונות"],
  ["video", [["work", "video"]], "Project: Video heading", "פרויקט: כותרת וידאו"],
  ["details", [["work", "details"]], "Project: Details heading", "פרויקט: כותרת פרטים"],
  ["project_shop", [["shop", "projectShop"]], "Project: From the shop heading", "פרויקט: כותרת מהחנות"],
  ["work_all", [["work", "all"]], "Projects page: All filter", "עמוד פרויקטים: מסנן הכול"],
  ["work_back", [["work", "back"]], "Project: All projects link", "פרויקט: קישור כל הפרויקטים"],
  ["work_previous", [["work", "previous"]], "Project: Previous project link", "פרויקט: קישור הפרויקט הקודם"],
  ["work_next", [["work", "next"]], "Project: Next project link", "פרויקט: קישור הפרויקט הבא"],
  // About and contact
  ["about_team", [["about", "team"]], "About: Creators heading", "אודות: כותרת היוצרים"],
  ["contact_email", [["contact", "email"]], "Contact: Email heading", "יצירת קשר: כותרת מייל"],
  ["contact_phone", [["contact", "phone"]], "Contact: Phone heading", "יצירת קשר: כותרת טלפון"],
  ["contact_location", [["contact", "location"]], "Contact: Location heading", "יצירת קשר: כותרת מיקום"],
  ["contact_social", [["contact", "social"]], "Contact: Follow us heading", "יצירת קשר: כותרת עקבו אחרינו"],
  ["consult_title", [["consult", "title"]], "Contact: Private consultation heading", "יצירת קשר: כותרת התייעצות פרטית"],
  ["consult_intro", [["consult", "intro"]], "Contact: Private consultation opening line", "יצירת קשר: משפט פתיחה להתייעצות"],
  // Shop
  ["shop_all", [["shop", "all"]], "Shop: All category", "חנות: קטגוריה הכול"],
  ["shop_empty", [["shop", "empty"]], "Shop: no products yet", "חנות: הודעה כשאין מוצרים"],
  ["shop_category_empty", [["shop", "categoryEmpty"]], "Shop: empty category message", "חנות: הודעה לקטגוריה ריקה"],
  ["shop_coming_soon", [["shop", "comingSoon"]], "Shop: Coming soon tag", "חנות: תגית בקרוב"],
  ["shop_details", [["shop", "details"]], "Shop: product box button", "חנות: כפתור בתיבת מוצר"],
  ["shop_add", [["shop", "addToOrder"]], "Product: Add to order button", "מוצר: כפתור הוספה להזמנה"],
  ["shop_from_project", [["shop", "fromProject"]], "Product: From the project", "מוצר: מתוך הפרויקט"],
  ["shop_returns", [["shop", "returnsTitle"]], "Product: Shipping and returns heading", "מוצר: כותרת משלוח והחזרות"],
  ["shop_view_order", [["shop", "viewOrder"]], "Shop: Your order link", "חנות: קישור ההזמנה שלכם"],
  ["shop_order_title", [["shop", "orderTitle"]], "Order page heading", "עמוד ההזמנה: כותרת"],
  ["shop_summary", [["shop", "summary"]], "Order: Summary heading", "הזמנה: כותרת סיכום"],
  ["shop_send", [["shop", "sendOrder"]], "Order: Send button", "הזמנה: כפתור שליחה"],
  ["shop_continue", [["shop", "continue"]], "Order: Continue shopping link", "הזמנה: קישור להמשך קנייה"],
  ["shop_pay_title", [["shop", "payTitle"]], "Order: Payment heading", "הזמנה: כותרת תשלום"],
  // Footer
  ["footer_top", [["footer", "top"]], "Footer: Back to top", "תחתית: חזרה למעלה"],
];
