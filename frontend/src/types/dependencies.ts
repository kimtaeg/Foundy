/** Dependencies injected into the existing simulation rules and workflows. */
export interface ReplyDependencies {
  S: any;
  RS: any;
  optList: any;
  A: any;
  pendingDecisions: any;
  curAction: any;
  allTasks: any;
  tasks: any;
  cardShort: any;
  buildCards: any;
  CH: any;
}

export interface AlertDependencies {
  S: any;
  SIM: any;
  NEXTLOG: any;
  CHGLOG: any;
  pendingDecisions: any;
  allTasks: any;
}

export interface ProfileWorkflowDependencies {
  modalState: any;
  modal: any;
  setTimeout: any;
  mpDraft: any;
  mpDiff: any;
  toast: any;
  mpValidate: any;
  mpImpacts: any;
  resetList: any;
  fmtMp: any;
  RS: any;
  NEXTLOG: any;
  S: any;
  num: any;
  saveS: any;
  put: any;
  syncLinks: any;
  recalc: any;
  CAL: any;
  CHGLOG: any;
  MP: any;
  W: any;
  runAnalysis: any;
  goto: any;
  cancelPending: any;
  X: any;
  CANDX: any;
  AUTO: any;
  PRICE: any;
  tasks: any;
  CH: any;
  closeModal: any;
}

export interface ProfileDependencies {
  eff: any;
  S: any;
  MP: any;
  normMp: any;
  buildCards: any;
  RS: any;
  cardShort: any;
}

export interface ReportDependencies {
  S: any;
  buildCards: any;
  RS: any;
}

export interface FollowUpDependencies {
  buildCards: any;
  S: any;
  RS: any;
  pendingDecisions: any;
  curAction: any;
  cardShort: any;
  allTasks: any;
  NEXTLOG: any;
  put: any;
  setTimeout: any;
  document: any;
}

export interface OnboardingDependencies {
  W: any;
  clearTimeout: any;
  setTimeout: any;
  currentPage: any;
  S: any;
  RS: any;
  put: any;
  X: any;
  CANDX: any;
  NEXTLOG: any;
  tasks: any;
  $: any;
  saveS: any;
}
