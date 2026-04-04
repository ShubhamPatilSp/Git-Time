import mongoose, { Document, Model, Schema } from "mongoose"

export interface IJob extends Document {
  jobId: string;
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalCommits: number;
  progress: number;
  message: string;
  startDate?: string;
  endDate?: string;
  totalDays?: number;
  commits?: any[];
  downloadUrl?: string;
  error?: string;
  coAuthorToken?: string;
  coAuthorRepoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema: Schema = new Schema({
  jobId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  totalCommits: { type: Number, default: 0 },
  progress: { type: Number, default: 0 },
  message: { type: String, default: 'Pending...' },
  startDate: { type: String },
  endDate: { type: String },
  totalDays: { type: Number },
  commits: { type: Schema.Types.Mixed, default: [] },
  downloadUrl: { type: String },
  error: { type: String },
  coAuthorRepoUrl: { type: String },
}, { 
  timestamps: true 
})

const Job: Model<IJob> = mongoose.models.Job || mongoose.model<IJob>("Job", JobSchema)
export default Job
