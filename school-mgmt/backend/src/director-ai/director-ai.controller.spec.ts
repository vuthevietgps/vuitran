import { AiAssistantType } from '../chatbot/schemas/ai-assistant-profile.schema';
import { Role } from '../common/interfaces/role.enum';
import { DirectorAiController } from './director-ai.controller';

describe('DirectorAiController compatibility adapter', () => {
  const user = {
    sub: '64b000000000000000000001',
    email: 'director@example.com',
    fullName: 'Director',
    role: Role.DIRECTOR,
  };

  let aiChatService: {
    chat: jest.Mock;
    getMySessions: jest.Mock;
    getMessages: jest.Mock;
  };
  let controller: DirectorAiController;

  beforeEach(() => {
    aiChatService = {
      chat: jest.fn(),
      getMySessions: jest.fn(),
      getMessages: jest.fn(),
    };
    controller = new DirectorAiController(
      aiChatService as any,
      { isToolAllowed: jest.fn().mockReturnValue(true) } as any,
    );
  });

  it('delegates legacy chat requests to AI core with director assistant type', async () => {
    aiChatService.chat.mockResolvedValue({
      sessionId: '64b000000000000000000101',
      messageId: '64b000000000000000000102',
      answer: 'ok',
      toolKeys: ['daily_tasks'],
      contextPlan: [],
    });

    const result = await controller.chat(
      { message: 'Hom nay can xu ly gi?' },
      { user } as any,
    );

    expect(aiChatService.chat).toHaveBeenCalledWith(
      {
        message: 'Hom nay can xu ly gi?',
        assistantType: AiAssistantType.DIRECTOR_OPERATIONS,
      },
      user,
    );
    expect(result.contextKeys).toEqual(['daily_tasks']);
    expect(result.toolKeys).toEqual(['daily_tasks']);
  });

  it('maps AI core session keys to legacy lastContextKeys', async () => {
    aiChatService.getMySessions.mockResolvedValue({
      data: [
        {
          _id: '64b000000000000000000201',
          title: 'Daily brief',
          lastToolKeys: ['director_dashboard'],
        },
      ],
    });

    const result = await controller.getMySessions({ user } as any);

    expect(aiChatService.getMySessions).toHaveBeenCalledWith(
      { assistantType: AiAssistantType.DIRECTOR_OPERATIONS },
      user,
    );
    expect(result.data[0].lastContextKeys).toEqual(['director_dashboard']);
  });

  it('maps AI core message keys to legacy contextKeys', async () => {
    aiChatService.getMessages.mockResolvedValue({
      data: [
        {
          _id: '64b000000000000000000301',
          role: 'ASSISTANT',
          content: 'ok',
          toolKeys: ['financial_alerts'],
        },
      ],
    });

    const query = { sessionId: '64b000000000000000000201', limit: '20' };
    const result = await controller.getMessages(query, { user } as any);

    expect(aiChatService.getMessages).toHaveBeenCalledWith(query, user);
    expect(result.data[0].contextKeys).toEqual(['financial_alerts']);
  });
});
