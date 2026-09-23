import { Test } from '@nestjs/testing';

import { AiModule } from '../../../src/ai/ai.module';
import { AiService } from '../../../src/ai/ai.service';

describe('AiModule.register', () => {
  it('registers a configured AiService instance', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        AiModule.register({
          classifyModel: 'anthropic/claude-haiku-4.5',
          digestModel: 'anthropic/claude-sonnet-5',
          transport: { customSupportsStructuredOutputs: true },
        }),
      ],
    }).compile();

    expect(moduleRef.get(AiService)).toBeInstanceOf(AiService);
  });
});
