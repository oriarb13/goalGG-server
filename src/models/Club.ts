import mongoose, { Document, Schema } from "mongoose";
import {
  SportCategoryEnum,
  ClubStatusEnum,
  UserRoleEnum,
} from "../types/enums";

// ==================== Club (קהילה) Schema ====================
interface IClub extends Document {
  name: string;
  description: string;
  admin: mongoose.Types.ObjectId;
  captains: mongoose.Types.ObjectId[];
  members: {
    userId: mongoose.Types.ObjectId;
    skillRating: number;
    positions: string[];
    goals?: number;
    assists?: number;
    points?: number;
    matchesCount?: number;
  }[];
  pendingRequests: { userId: mongoose.Types.ObjectId; role: string }[];
  sportCategory: SportCategoryEnum;
  image: string;
  status: ClubStatusEnum;
  maxPlayers: number; // הגבלה לפי סוג המנוי
  location: {
    country: string;
    city: string;
    address: string;
    lat: number;
    lng: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ClubSchema = new Schema<IClub>(
  {
    name: {
      type: String,
      required: [true, "Please provide a club name"],
      trim: true,
      maxlength: [30, "Club name cannot be more than 30 characters"],
    },
    description: {
      type: String,
      required: [true, "Please provide a club description"],
      trim: true,
      maxlength: [500, "Description cannot be more than 500 characters"],
    },
    admin: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Please provide an admin user"],
    },
    captains: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    sportCategory: {
      type: String,
      enum: Object.values(SportCategoryEnum),
      required: [true, "Please provide a sport category"],
    },
    members: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        skillRating: {
          type: Number,
        },
        positions: {
          type: [String],
        },
        goals: {
          type: Number,
        },
        assists: {
          type: Number,
        },
        points: {
          type: Number,
        },
        matchesCount: {
          type: Number,
        },
      },
    ],
    pendingRequests: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        role: {
          type: String,
          enum: Object.values(UserRoleEnum),
        },
      },
    ],
    image: {
      type: String,
      default: "default-club.jpg",
    },
    status: {
      type: String,
      enum: Object.values(ClubStatusEnum),
      default: ClubStatusEnum.ACTIVE,
    },
    maxPlayers: {
      type: Number,
      required: [true, "Please specify max number of players"],
      min: [2, "Club must allow at least 2 players"],
    },
    location: {
      country: {
        type: String,
        trim: true,
      },
      city: {
        type: String,
        trim: true,
      },
      address: {
        type: String,
        trim: true,
      },
      lat: {
        type: Number,
      },
      lng: {
        type: Number,
      },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IClub>("Club", ClubSchema);
