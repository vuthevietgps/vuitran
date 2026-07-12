import { AiContextBuilderService } from './context-builder.service';
import { AiToolRegistryService } from './tool-registry.service';
import { AiToolDefinition } from './ai-core.types';
import { Role } from '../common/interfaces/role.enum';
import { AiAssistantType } from '../chatbot/schemas/ai-assistant-profile.schema';

const tool: AiToolDefinition = {
  key: 'secret_probe',
  capability: 'ADMIN_SECURITY',
  label: 'Secret probe',
  businessName: 'Secret probe',
  businessMeaning: 'Test redaction',
  route: 'GET /secret-probe',
  method: 'GET',
  serviceMethod: 'SecretProbeService.find()',
  operation: 'READ_DETAIL',
  allowedRoles: [Role.DIRECTOR],
  allowedAssistantTypes: [AiAssistantType.DIRECTOR_OPERATIONS],
  dataScope: 'GLOBAL',
  inputSchemaSummary: 'none',
  outputSchemaSummary: 'secret fields',
  defaultFilters: { dateRange: 'none', limit: 1 },
  contextPolicy: 'redact secrets',
  writePolicy: 'none',
  riskLevel: 'CRITICAL',
  requiresConfirmation: false,
  requiresApproval: false,
  requiresAudit: true,
  enabled: true,
};

describe('AiContextBuilderService', () => {
  it('redacts token, secret, api key, password, bank account and media-like fields before prompt context', async () => {
    const registry = {
      execute: jest.fn().mockResolvedValue({
        key: 'secret_probe',
        label: 'Secret probe',
        sourceRoute: 'GET /secret-probe',
        data: {
          apiToken: 'token-value',
          appSecret: 'secret-value',
          api_key: 'api-key-value',
          passwordHash: 'password-value',
          accountNumber: '1234567890',
          receiptImage: 'https://cdn.local/receipt.png',
          proofFileUrl: 'https://cdn.local/proof.pdf',
          attachments: ['https://cdn.local/private.docx'],
          safeName: 'Visible',
        },
        metadata: { truncated: false },
      }),
    } as unknown as AiToolRegistryService;

    const service = new AiContextBuilderService(registry);
    const context = await service.buildContext([tool], {}, {
      assistantType: AiAssistantType.DIRECTOR_OPERATIONS,
      user: {
        sub: '64b000000000000000000001',
        _id: '64b000000000000000000001',
        userId: '64b000000000000000000001',
        email: 'director@example.com',
        role: Role.DIRECTOR,
        fullName: 'Director',
      },
    });

    expect(context[0].data).toMatchObject({
      apiToken: '[redacted]',
      appSecret: '[redacted]',
      api_key: '[redacted]',
      passwordHash: '[redacted]',
      accountNumber: '[redacted]',
      receiptImage: '[redacted]',
      proofFileUrl: '[redacted]',
      attachments: '[redacted]',
      safeName: 'Visible',
    });
  });
});
