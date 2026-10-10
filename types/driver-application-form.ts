export type EmploymentRecord = {
  employer: string;
  from: string;
  to: string;
  equipment: string;
  reasonLeaving: string;
  contactPhone: string;
};

export type DriverReference = {
  name: string;
  phone: string;
  relation: string;
};

export type DriverApplicationFormData = {
  /** Personal */
  middleName?: string;
  dateOfBirth?: string;
  ssnLast4?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zip?: string;
  /** Contact */
  altPhone?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  /** CDL */
  cdlClass?: string;
  cdlState?: string;
  cdlExpiration?: string;
  endorsements?: string;
  medCardExpiration?: string;
  hasTwic?: string;
  hasHazmat?: string;
  hasTanker?: string;
  /** Experience */
  totalYearsExp?: string;
  otrYearsExp?: string;
  equipmentTypes?: string;
  preferredFreight?: string;
  statesRun?: string;
  /** Employment history */
  employmentHistory?: EmploymentRecord[];
  /** Safety */
  accidentsPast3Years?: string;
  accidentDetails?: string;
  violationsPast3Years?: string;
  violationDetails?: string;
  licenseSuspensions?: string;
  failedDrugTest?: string;
  sapProgram?: string;
  /** Criminal */
  felonies?: string;
  felonyDetails?: string;
  misdemeanors?: string;
  misdemeanorDetails?: string;
  dui?: string;
  duiDetails?: string;
  /** Preferences */
  driverType?: string;
  desiredPay?: string;
  homeTimePref?: string;
  availableDate?: string;
  teamDriver?: string;
  ownerOperator?: string;
  /** References */
  references?: DriverReference[];
  /** Legacy flat keys from scaffold */
  cdlNumber?: string;
  experience?: string;
  /** Free-form notes */
  additionalNotes?: string;
};

export type DriverApplicationDocument = {
  id: string;
  label: string;
  fileName: string;
  storagePath: string;
  uploadedAt: string;
};
