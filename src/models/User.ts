import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";
import {
  UserRoleEnum,
  SportCategoryEnum,
  StrongSideEnum,
  footballPositionsEnum,
  basketballPositionsEnum,
  AccountStatusEnum,
} from "../types/enums";

// ממשק בסיסי משותף למשתמשים
interface IUserBase extends Document {
  _id: string;
  role: UserRoleEnum;
  firstName: string;
  lastName: string;
  image: string;
  positions: string[]; // יכיל עמדות כדורגל או כדורסל לפי ספורט קטגורי
  sportCategory: SportCategoryEnum;
  age: number;
  cm: number; // גובה בס"מ
  kg: number; // משקל בק"ג
  strongSide: StrongSideEnum;
  avgSkillRating: number;
  email: string;
  isEmailVerified: boolean;
  phone: {
    prefix: string;
    number: string;
  };
  region: string;
  city: string;
  password: string;
  accountStatus: AccountStatusEnum;
  location: {
    lat: number;
    lng: number;
  };
  favoriteFields: mongoose.Types.ObjectId[];
  friends: mongoose.Types.ObjectId[];
  friendRequests: mongoose.Types.ObjectId[];
  groups: mongoose.Types.ObjectId[];
  groupsRequests: mongoose.Types.ObjectId[];
  totalStats: {
    totalGames: number;
    totalPoints: number;
    totalAssists: number;
  };
  subscriptions: {
    groupIds: mongoose.Types.ObjectId[];
    maxGroups: number;
    startDate?: Date;
    endDate?: Date;
    maxPlayers: number;
    cost: number;
    isActive: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
  matchPassword: (enteredPassword: string) => Promise<boolean>;
  fullName: string; // Virtual
}

// ממשק למשתמש רגיל
export interface IUser extends IUserBase {
  role: UserRoleEnum.USER;
}

// ממשק למשתמש מסוג סילבר
export interface ISilver extends IUserBase {
  role: UserRoleEnum.SILVER;
  subscriptions: {
    groupIds: mongoose.Types.ObjectId[];
    maxGroups: number; // 1
    startDate: Date;
    endDate: Date;
    maxPlayers: number; // 25
    cost: number; // 15
    isActive: boolean;
  };
}

// ממשק למשתמש מסוג גולד
export interface IGold extends IUserBase {
  role: UserRoleEnum.GOLD;
  subscriptions: {
    groupIds: mongoose.Types.ObjectId[];
    maxGroups: number; // 3
    startDate: Date;
    endDate: Date;
    maxPlayers: number; // 30
    cost: number; // 25
    isActive: boolean;
  };
}

// ממשק למשתמש מסוג פרימיום
export interface IPremium extends IUserBase {
  role: UserRoleEnum.PREMIUM;
  subscriptions: {
    groupIds: mongoose.Types.ObjectId[];
    maxGroups: number; // 5
    startDate: Date;
    endDate: Date;
    maxPlayers: number; // 500
    cost: number; // 40
    isActive: boolean;
  };
}

// ממשק למשתמש מסוג סופר אדמין
export interface ISuperAdmin extends IUserBase {
  role: UserRoleEnum.SUPER_ADMIN;
  subscriptions: {
    groupIds: mongoose.Types.ObjectId[];
    maxGroups: number; // unlimited 
    startDate: Date;
    endDate: Date;
    maxPlayers: number; // unlimited
    cost: number; // 0
    isActive: boolean;
  };
}

// טיפוס איחוד של כל סוגי המשתמשים
export type UserDocument = IUser | ISilver | IGold | IPremium | ISuperAdmin;

// סכמת משתמש בסיסית
const UserSchema: Schema = new Schema(
  {
    firstName: {
      type: String,
      required: [true, "Please provide a first name"],
      trim: true,
      maxlength: [12, "First name cannot be more than 12 characters"],
    },
    lastName: {
      type: String,
      required: [true, "Please provide a last name"],
      trim: true,
      maxlength: [12, "Last name cannot be more than 12 characters"],
    },
    image: {
      type: String,
      default: "default-profile.jpg",
    },
    sportCategory: {
      type: String,
      required: [true, "Please provide a sport category"],
      enum: Object.values(SportCategoryEnum),
    },
    positions: {
      type: [String],
      validate: {
        validator: function (this: UserDocument, positions: string[]) {
          if (positions.length === 0) return true; // אפשר מערך ריק

          // בדיקה שכל העמדות שייכות לקטגורית הספורט הנכונה
          if (this.sportCategory === SportCategoryEnum.FOOTBALL) {
            return positions.every((pos) =>
              Object.values(footballPositionsEnum).includes(
                pos as footballPositionsEnum
              )
            );
          } else if (this.sportCategory === SportCategoryEnum.BASKETBALL) {
            return positions.every((pos) =>
              Object.values(basketballPositionsEnum).includes(
                pos as basketballPositionsEnum
              )
            );
          }
          return false;
        },
        message: "Positions must match the selected sport category",
      },
      default: [],
    },
    age: {
      type: Number,
      required: [true, "Please provide your age"],
      min: [8, "Age must be at least 8"],
      max: [100, "Age must be at most 100"],
    },
    cm: {
      type: Number,
      min: [100, "Height must be at least 100 cm"],
      max: [300, "Height must be at most 300 cm"],
    },
    kg: {
      type: Number,
      min: [30, "Weight must be at least 30 kg"],
      max: [200, "Weight must be at most 200 kg"],
    },
    strongSide: {
      type: String,
      enum: Object.values(StrongSideEnum),
    },
    avgSkillRating: {
      type: Number,
      default: 0,
      min: [0, "Rating must be at least 0"],
      max: [10, "Rating must be at most 10"],
    },
    email: {
      type: String,
      required: [true, "Please provide an email"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    phone: {
      prefix: {
        type: String,
        required: [true, "Please provide a phone prefix"],
        trim: true,
        minlength: [1, "Phone prefix must be at least 1 character"],
        maxlength: [5, "Phone prefix must be at most 5 characters"],
      },
      number: {
        type: String,
        required: [true, "Please provide a phone number"],
        trim: true,
        minlength: [1, "Phone number must be at least 1 character"],
        maxlength: [10, "Phone number must be at most 10 characters"],
        validate: {
          validator: function (value: string) {
            // בדיקה שמספר הטלפון מכיל רק ספרות
            return /^\d+$/.test(value);
          },
          message: "Phone number must contain only digits",
        },
      },
    },
    city: {
      type: String,
      trim: true,
      maxlength: [30, "City name cannot be more than 30 characters"],
    },
    region: {
      type: String,
      trim: true,
      maxlength: [30, "Region name cannot be more than 30 characters"],
    },
    password: {
      type: String,
      required: [true, "Please provide a password"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    accountStatus: {
      type: String,
      enum: Object.values(AccountStatusEnum),
      default: AccountStatusEnum.ACTIVE,
    },
    location: {
      lat: Number,
      lng: Number,
    },
    favoriteFields: {
      type: [Schema.Types.ObjectId],
      ref: "Field",
      default: [],
    },
    friends: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    friendRequests: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    groups: {
      type: [Schema.Types.ObjectId],
      ref: "Group",
      default: [],
    },
    groupsRequests: {
      type: [Schema.Types.ObjectId],
      ref: "Group",
      default: [],
    },
    totalStats: {
      totalGames: {
        type: Number,
        default: 0,
      },
      totalPoints: {
        type: Number,
        default: 0,
      },
      totalAssists: {
        type: Number,
        default: 0,
      },
    },
    role: {
      type: String,
      enum: Object.values(UserRoleEnum),
      required: true,
    },
    // מנויים לסוגי המשתמשים השונים - מותאם לתמוך במבנה הממשקים
    subscriptions: {
      groupIds: {
        type: [Schema.Types.ObjectId],
        ref: "Group",
        default: [],
      },
      maxGroups: {
        type: Number,
        default: 0, // ערך ברירת מחדל קבוע במקום פונקציה
      },
      startDate: {
        type: Date,
      },
      endDate: {
        type: Date,
      },
      maxPlayers: {
        type: Number,
        default: 0, // ערך ברירת מחדל קבוע במקום פונקציה
      },
      cost: {
        type: Number,
        default: 0, // ערך ברירת מחדל קבוע במקום פונקציה
      },
      isActive: {
        type: Boolean,
        default: true,
      },
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // יאפשר עדכון אוטומטי של createdAt ו-updatedAt
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.password;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.password;
        return ret;
      },
    },
  }
);

// וירטואלים
UserSchema.virtual("fullName").get(function (this: UserDocument) {
  return `${this.firstName} ${this.lastName}`;
});

// מילוי ערכי ברירת מחדל לשדות subscriptions לפי סוג המשתמש
UserSchema.pre("save", async function (this: UserDocument, next) {
  // קביעת הערכים המתאימים לסוג המנוי
  if (this.isNew || this.isModified("role")) {
    if (this.role === UserRoleEnum.SILVER) {
      this.subscriptions = {
        ...this.subscriptions,
        maxGroups: 1,
        maxPlayers: 25,
        cost: 15,
      };
    } else if (this.role === UserRoleEnum.GOLD) {
      this.subscriptions = {
        ...this.subscriptions,
        maxGroups: 3,
        maxPlayers: 30,
        cost: 25,
      };
    } else if (this.role === UserRoleEnum.PREMIUM) {
      this.subscriptions = {
        ...this.subscriptions,
        maxGroups: 5,
        maxPlayers: 500,
        cost: 40,
      };
    } else if (this.role === UserRoleEnum.SUPER_ADMIN) {
      this.subscriptions = {
        ...this.subscriptions,
        maxGroups: 1000,
        maxPlayers: 1000,
        cost: 0,
      };
    }
  }
  next();
});

// Validators
UserSchema.path("email").validate(async function (email: string) {
  const user = this;
  if (!user.isNew) return true; // אם המסמך אינו חדש, אל תבדוק

  const count = await mongoose.models.User.countDocuments({ email });
  return count === 0;
}, "Email already exists");

// Hash password before saving
UserSchema.pre("save", async function (this: UserDocument, next) {
  if (!this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to match password
UserSchema.methods.matchPassword = async function (
  enteredPassword: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(enteredPassword, this.password);
  } catch (error) {
    return false;
  }
};

// יצירת המודל
const User = mongoose.model<UserDocument>("User", UserSchema);

export default User;
