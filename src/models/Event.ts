import mongoose, { Document, Schema } from "mongoose";
import { SportCategoryEnum } from "../types/enums";

// ממשק דינמי לקבוצות
interface ITeam {
  name: string;
  players: mongoose.Types.ObjectId[];
}

// ==================== Event (אירוע) Schema ====================
interface IEvent extends Document {
  name: string;
  description: string;
  clubId: mongoose.Types.ObjectId;
  fieldId: mongoose.Types.ObjectId;
  location: {
    address: string;
    lat: number;
    lng: number;
  };
  image: string;
  time: {
    start: Date;
    end: Date;
  };
  teams: Map<string, mongoose.Types.ObjectId[]>;
  status: "upcoming" | "ongoing" | "completed";
  sportCategory: SportCategoryEnum;
  maxParticipants: number;
  minParticipantsToStart: number;
  cost: number;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<IEvent>(
  {
    name: {
      type: String,
      required: [true, "Please provide an event name"],
      trim: true,
      maxlength: [50, "Event name cannot be more than 50 characters"],
    },
    description: {
      type: String,
      required: [true, "Please provide an event description"],
      trim: true,
      maxlength: [1000, "Description cannot be more than 1000 characters"],
    },
    clubId: {
      type: Schema.Types.ObjectId,
      ref: "Club",
      required: [true, "Please provide a club ID"],
    },
    fieldId: {
      type: Schema.Types.ObjectId,
      ref: "Field",
      required: [true, "Please provide a field ID"],
    },
    location: {
      address: {
        type: String,
        required: [true, "Please provide an address"],
      },
      lat: {
        type: Number,
        required: [true, "Please provide a latitude"],
      },
      lng: {
        type: Number,
      },
    },
    image: {
      type: String,
      default: "default-event.jpg",
    },
    time: {
      start: {
        type: Date,
        required: [true, "Please provide a start time"],
      },
      end: {
        type: Date,
        required: [true, "Please provide an end time"],
      },
    },
    teams: {
      type: Map,
      of: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: new Map(),
    },
    status: {
      type: String,
      enum: ["upcoming", "ongoing", "completed"],
      default: "upcoming",
    },
    sportCategory: {
      type: String,
      enum: Object.values(SportCategoryEnum),
      required: [true, "Please provide a sport category"],
    },
    maxParticipants: {
      type: Number,
      default: 1000,
    },
    minParticipantsToStart: {
      type: Number,
      default: 2,
    },
    cost: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

//index by clubId
EventSchema.index({ clubId: 1 });

//index by status
EventSchema.index({ status: 1 });

export default mongoose.model<IEvent>("Event", EventSchema);
