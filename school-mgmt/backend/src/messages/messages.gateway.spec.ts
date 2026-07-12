import { MessagesGateway } from './messages.gateway';

describe('MessagesGateway', () => {
  function socket(overrides: Record<string, unknown> = {}) {
    return {
      id: 'socket-1',
      data: {},
      handshake: {
        auth: {},
        headers: {},
        query: {},
      },
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
      ...overrides,
    } as any;
  }

  function gateway() {
    const messagesService = {
      getSocketUser: jest.fn().mockResolvedValue({ _id: { toString: () => 'user-1' } }),
      assertCanJoinConversation: jest.fn().mockResolvedValue(undefined),
      sendMessage: jest.fn(),
      sendToConversation: jest.fn(),
      markRead: jest.fn(),
    };
    const jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1' }),
    };
    return {
      service: messagesService,
      jwt: jwtService,
      gateway: new MessagesGateway(messagesService as any, jwtService as any),
    };
  }

  it('rejects sockets that only provide query userId without a JWT', async () => {
    const { gateway: subject, jwt } = gateway();
    const client = socket({
      handshake: {
        auth: {},
        headers: {},
        query: { userId: 'spoofed-user' },
      },
    });

    await subject.handleConnection(client);

    expect(jwt.verifyAsync).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledTimes(1);
    expect(client.join).not.toHaveBeenCalled();
  });

  it('authenticates sockets from the access_token cookie before joining the user room', async () => {
    const { gateway: subject, jwt, service } = gateway();
    const client = socket({
      handshake: {
        auth: {},
        headers: { cookie: 'theme=dark; access_token=jwt-cookie-value' },
        query: {},
      },
    });

    await subject.handleConnection(client);

    expect(jwt.verifyAsync).toHaveBeenCalledWith('jwt-cookie-value');
    expect(service.getSocketUser).toHaveBeenCalledWith('user-1');
    expect(client.data.userId).toBe('user-1');
    expect(client.join).toHaveBeenCalledWith('user:user-1');
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('checks conversation access before joining a conversation room', async () => {
    const { gateway: subject, service } = gateway();
    const client = socket({ data: { userId: 'user-1' } });

    await subject.handleJoinConversation(client, { conversationId: 'conversation-1' });

    expect(service.assertCanJoinConversation).toHaveBeenCalledWith('user-1', 'conversation-1');
    expect(client.join).toHaveBeenCalledWith('conversation:conversation-1');
  });
});
