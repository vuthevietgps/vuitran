import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessageSchema } from './schemas/message.schema';
import { ConversationSchema } from './schemas/conversation.schema';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { MessagesGateway } from './messages.gateway';
import { DIRECT_CONVERSATION_MODEL, DIRECT_MESSAGE_MODEL } from './messages.constants';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { OpenAIToken, OpenAITokenSchema } from '../chatbot/schemas/openai-token.schema';
import {
  AiAssistantProfile,
  AiAssistantProfileSchema,
} from '../chatbot/schemas/ai-assistant-profile.schema';
import { Session, SessionSchema } from '../sessions/schemas/session.schema';
import { TicketsModule } from '../tickets/tickets.module';
import {
  StudentSupportSnapshot,
  StudentSupportSnapshotSchema,
} from './schemas/student-support-snapshot.schema';
import { StudentSupportSnapshotService } from './student-support-snapshot.service';
import { Classroom, ClassroomSchema } from '../classes/schemas/class.schema';
import {
  TeachingMaterial,
  TeachingMaterialSchema,
} from '../teaching-materials/schemas/teaching-material.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DIRECT_MESSAGE_MODEL, schema: MessageSchema, collection: 'direct_messages' },
      { name: DIRECT_CONVERSATION_MODEL, schema: ConversationSchema, collection: 'direct_conversations' },
      { name: User.name, schema: UserSchema },
      { name: Student.name, schema: StudentSchema },
      { name: OpenAIToken.name, schema: OpenAITokenSchema },
      { name: AiAssistantProfile.name, schema: AiAssistantProfileSchema },
      { name: Session.name, schema: SessionSchema },
      { name: Classroom.name, schema: ClassroomSchema },
      { name: TeachingMaterial.name, schema: TeachingMaterialSchema },
      { name: StudentSupportSnapshot.name, schema: StudentSupportSnapshotSchema },
    ]),
    forwardRef(() => TicketsModule),
  ],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesGateway, StudentSupportSnapshotService],
  exports: [MessagesService, StudentSupportSnapshotService],
})
export class MessagesModule {}
