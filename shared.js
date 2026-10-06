// Content and constants shared by the landing page, the branch pages and
// app.js. Anything that must be identical everywhere is written here once.

export const BRANCH_IDS = ['mitzpe', 'eilat', 'hafetz-haim'];

// The gemach explanation - shown on the landing page and on every branch page.
export const INTRO_TITLE = "מי אנחנו?";
export const INTRO_BODY_HTML = "מתנות קטנות הוא גמ\"ח לרגעים הפשוטים שלכם ביחד. יש לנו משחקים, ספרים וערכות דייטים מפנקות שתוכלו לשאול ולהנות מזמן זוגי.<br/><br/>\r\n      בואו לשרוף סיר פויקה ביחד בדייט שישי, לפתוח קלפים ולגלות עוד קצת דברים חדשים, להתחרות בדאבל אם אתם סבא וסבתא צעירים ברוח, להתכרבל על ספה מול סרט חודשיים אחרי החתונה, או סתם לפתוח ספר בנושא. אנחנו פה בשביל כולםםם.";

// Same categories for every branch. Everything that lists categories (filter
// buttons, admin dropdowns, card icons, placeholder images, the "kit" fields)
// is built from this array.
export const CATEGORIES = [
  {
    "id": "cat1",
    "name": "פותחים קופסא",
    "icon": "&#127183;",
    "filterIcon": "🎲",
    "placeholder": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjYwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjI2MCIgZmlsbD0iI0VBRjVGMCIgcng9IjEyIi8+PHRleHQgeD0iMjAwIiB5PSIxNTAiIGZvbnQtc2l6ZT0iNzIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPvCfg48</text></svg>",
    "kit": false
  },
  {
    "id": "cat2",
    "name": "בין השורות",
    "icon": "&#128214;",
    "filterIcon": "📖",
    "placeholder": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjYwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjI2MCIgZmlsbD0iI0VBRjVGMCIgcng9IjEyIi8+PHRleHQgeD0iMjAwIiB5PSIxNTAiIGZvbnQtc2l6ZT0iNzIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPvCfkJY8L3RleHQ+PC9zdmc+",
    "kit": false
  },
  {
    "id": "cat3",
    "name": "דייט על קלף",
    "icon": "&#128149;",
    "filterIcon": "🃏",
    "placeholder": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjYwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjI2MCIgZmlsbD0iI0VBRjVGMCIgcng9IjEyIi8+PHRleHQgeD0iMjAwIiB5PSIxNTAiIGZvbnQtc2l6ZT0iNzIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPvCfmIk8L3RleHQ+PC9zdmc+",
    "kit": false
  },
  {
    "id": "cat4",
    "name": "המיוחדים שלנו",
    "icon": "&#127873;",
    "filterIcon": "✨",
    "placeholder": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjYwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjI2MCIgZmlsbD0iI0VBRjVGMCIgcng9IjEyIi8+PHRleHQgeD0iMjAwIiB5PSIxNTAiIGZvbnQtc2l6ZT0iNzIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPvCfmrs8L3RleHQ+PC9zdmc+",
    "kit": true
  }
];
export const KIT_CATEGORY = CATEGORIES.find(c => c.kit).name;

export const WA_TEXT = "היי, הגענו מהאתר של גמ\"ח מתנות קטנות :)";
