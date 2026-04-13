export const sexAgeSlideData = [
  {
    "label": "Adult men's cohorts",
    "count": 262,
    "percent": 48.1
  },
  {
    "label": "Adult women's cohorts",
    "count": 79,
    "percent": 14.5
  },
  {
    "label": "Boys' youth cohorts",
    "count": 132,
    "percent": 24.2
  },
  {
    "label": "Girls' youth cohorts",
    "count": 56,
    "percent": 10.3
  }
] as const;

export const sexAgeSlideMeta = {
  totalPapers: 499,
  totalPopulationUnits: 545,
  hiddenRemainderCount: 16,
  hiddenRemainderPct: 2.9,
  source: "/Users/abdelbabiker/Downloads/GBI-DE-MVP-main/Data Analysis/Data Cleaning/outputs/master/master-analysis-sheet.csv",
  method: "unique sex-age population units using ageCategory_standardized where available; surveillance programs collapsed; collegiate counted as adult; mixed-age split across youth and adult; unclear retained in denominator",
} as const;
