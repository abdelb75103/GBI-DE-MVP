export const TOPIC_REGISTRY = [
  {
    slug: 'hamstring',
    name: 'Hamstring',
    aliases: ['hamstring', 'hamstrings', 'posterior thigh'],
    exclusions: [],
  },
  {
    slug: 'groin',
    name: 'Groin',
    aliases: ['groin', 'adductor', 'hip and groin', 'inguinal'],
    exclusions: [],
  },
  {
    slug: 'acl-knee',
    name: 'ACL / Knee',
    aliases: ['acl', 'anterior cruciate ligament', 'knee', 'mcl', 'meniscus', 'cartilage injury'],
    exclusions: [],
  },
  {
    slug: 'ankle',
    name: 'Ankle',
    aliases: ['ankle', 'ankle sprain', 'lateral ankle'],
    exclusions: [],
  },
  {
    slug: 'concussion',
    name: 'Concussion / Head Injury',
    aliases: ['concussion', 'concussive', 'head injury', 'head impact', 'head trauma', 'traumatic brain injury', 'tbi'],
    exclusions: [],
  },
  {
    slug: 'illness',
    name: 'Illness',
    aliases: ['illness', 'illnesses', 'sickness', 'respiratory illness', 'gastrointestinal illness', 'infection'],
    exclusions: [],
  },
  {
    slug: 'exposure-workload',
    name: 'Exposure / Workload',
    aliases: ['exposure', 'training load', 'workload', 'match load', 'training hours', 'match hours', 'player load', 'load management'],
    exclusions: [],
  },
  {
    slug: 'womens-injury-incidence',
    name: "Women's Football Injury Incidence / Burden",
    aliases: ['women s football', 'women football', 'women soccer', 'female football', 'female soccer', 'female players', 'women players'],
    matchAllGroups: [
      ['women s football', 'women football', 'women soccer', 'female football', 'female soccer', 'female players', 'women players'],
      ['injury incidence', 'incidence', 'injuries', 'injury burden', 'burden', 'prevalence', 'time-loss'],
    ],
    exclusions: [],
  },
];
