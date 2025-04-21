import mongoose, { Document, Schema } from "mongoose";
import { SportCategoryEnum } from "../types/enums";

// ממשק בסיסי למשחק
interface IMatchBase extends Document {
  eventId: mongoose.Types.ObjectId;
  groupId: mongoose.Types.ObjectId;
  sportCategory: SportCategoryEnum;
  teams: [string, string];
  result: [number, number];
  createdAt: Date;
  updatedAt: Date;
}

// ממשק למשחק כדורגל
interface IFootballMatch extends IMatchBase {
  sportCategory: SportCategoryEnum.FOOTBALL;
  goals: Array<{
    scorer: mongoose.Types.ObjectId;
    assist?: mongoose.Types.ObjectId;
    team: string;
    minute?: number;
    duration?: number;
  }>;
}

// ממשק למשחק כדורסל
interface IBasketballMatch extends IMatchBase {
  sportCategory: SportCategoryEnum.BASKETBALL;
  teamStats: Record<
    string,
    Array<{
      playerId: mongoose.Types.ObjectId;
      points: number;
    }>
  >;
}

// סכמה בסיסית למשחק
const MatchBaseSchemaFields = {
  eventId: {
    type: Schema.Types.ObjectId,
    ref: "Event",
    required: [true, "Please provide an event ID"],
  },
  groupId: {
    type: Schema.Types.ObjectId,
    ref: "Group",
    required: [true, "Please provide a group ID"],
  },
  sportCategory: {
    type: String,
    enum: Object.values(SportCategoryEnum),
    required: [true, "Please provide a sport category"],
  },
  teams: {
    type: [String], // מערך של שני שמות קבוצות
    validate: {
      validator: function (teams: string[]) {
        return teams.length === 2;
      },
      message: "Teams array must contain exactly 2 team names",
    },
    required: [true, "Please provide two team names"],
  },
  result: {
    type: [Number], // מערך של שתי תוצאות
    validate: {
      validator: function (results: number[]) {
        return results.length === 2;
      },
      message: "Result array must contain exactly 2 scores",
    },
    default: [0, 0],
  },
};

// סכמה למשחק כדורגל
const FootballMatchSchema = new Schema(
  {
    ...MatchBaseSchemaFields,
    sportCategory: {
      type: String,
      enum: [SportCategoryEnum.FOOTBALL],
      required: [true, "This is a football match"],
    },
    goals: [
      {
        scorer: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        assist: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        team: {
          type: String,
          required: true,
        },
        minute: {
          type: Number,
          min: [0, "Minute cannot be negative"],
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// סכמה למשחק כדורסל
const BasketballMatchSchema = new Schema(
  {
    ...MatchBaseSchemaFields,
    sportCategory: {
      type: String,
      enum: [SportCategoryEnum.BASKETBALL],
      required: [true, "This is a basketball match"],
    },
    teamStats: {
      type: Map,
      of: [
        {
          playerId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
          },
          points: {
            type: Number,
            default: 0,
          },
        },
      ],
      default: () => new Map(),
    },
  },
  {
    timestamps: true,
  }
);

const MatchSchema = new Schema({}, { discriminatorKey: "sportCategory" });
//index by eventId
MatchSchema.index({ eventId: 1 });
//index by groupId
MatchSchema.index({ groupId: 1 });
// יצירת המודל הבסיסי
const Match = mongoose.model("Match", MatchSchema);

// יצירת המודלים הספציפיים עם אינדקסים ספציפיים

// אינדקס על scorer בגולים למשחקי כדורגל - לחיפוש מהיר של כל הגולים של שחקן ספציפי
FootballMatchSchema.index({ "goals.scorer": 1 });

// אינדקס על assist בגולים - לחיפוש מהיר של כל האסיסטים של שחקן ספציפי
FootballMatchSchema.index({ "goals.assist": 1 });

const FootballMatch = Match.discriminator("FootballMatch", FootballMatchSchema);
const BasketballMatch = Match.discriminator(
  "BasketballMatch",
  BasketballMatchSchema
);

export { Match, FootballMatch, BasketballMatch };
