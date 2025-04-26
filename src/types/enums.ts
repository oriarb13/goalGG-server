// סוגי משתמשים
export enum UserRoleEnum {
  USER = "user",
  SILVER = "silver",
  GOLD = "gold",
  PREMIUM = "premium",
  SUPER_ADMIN = "super_admin",
}

export enum SportCategoryEnum {
  FOOTBALL = "football",
  BASKETBALL = "basketball",
}
export enum StrongSideEnum {
  LEFT = "left",
  RIGHT = "right",
  BOTH = "both",
}

export enum footballPositionsEnum {
  GK = "gk",
  CB = "cb",
  RB = "rb",
  LB = "lb",
  CDM = "cdm",
  CM = "cm",
  CAM = "cam",
  LM = "lm",
  RM = "rm",
  CF = "cf",
  LW = "lw",
  RW = "rw",
  ST = "st",
}

export enum basketballPositionsEnum {
  PG = "pg",
  SG = "sg",
  SF = "sf",
  PF = "pf",
  C = "c",
}

export enum AccountStatusEnum {
  ACTIVE = "active",
  INACTIVE = "inactive",
  SUSPENDED = "suspended",
  LOCKED = "locked",
  PENDING_VERIFICATION = "pending_verification",
}

export enum RequestStatusEnum {
  PENDING = "pending",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
}

export enum GroupStatusEnum {
  ACTIVE = "active",
  INACTIVE = "inactive",
  FULL = "full",
}
