import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type TrackingAttributionDocument = HydratedDocument<TrackingAttribution>;

@Schema({ _id: false })
export class TrackingAttribution {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'LandingPage' })
  landingPageId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  landingPageSlug?: string;

  @Prop({ type: String, trim: true })
  landingPageName?: string;

  @Prop({ type: String, trim: true })
  submittedUrl?: string;

  @Prop({ type: String, trim: true })
  referrerUrl?: string;

  @Prop({ type: String, trim: true })
  eventId?: string;

  @Prop({ type: String, trim: true })
  fbclid?: string;

  @Prop({ type: String, trim: true })
  fbc?: string;

  @Prop({ type: String, trim: true })
  fbp?: string;

  @Prop({ type: String, trim: true })
  gclid?: string;

  @Prop({ type: String, trim: true })
  gbraid?: string;

  @Prop({ type: String, trim: true })
  wbraid?: string;

  @Prop({ type: String, trim: true })
  ttclid?: string;

  @Prop({ type: String, trim: true })
  ttp?: string;

  @Prop({ type: String, trim: true })
  utmSource?: string;

  @Prop({ type: String, trim: true })
  utmMedium?: string;

  @Prop({ type: String, trim: true })
  utmCampaign?: string;

  @Prop({ type: String, trim: true })
  utmContent?: string;

  @Prop({ type: String, trim: true })
  utmTerm?: string;
}

export const TrackingAttributionSchema = SchemaFactory.createForClass(TrackingAttribution);
