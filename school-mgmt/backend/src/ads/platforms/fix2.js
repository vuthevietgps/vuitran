const fs = require('fs');

function fixFile(filename, className) {
  let content = fs.readFileSync(filename, 'utf8');
  
  if (content.match(/constructor\s*\([\s\S]*?\{/)) {
      console.log('Class already has a constructor:', filename);
      return;
  }
  
  const imports = `import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { AdAccount, AdAccountDocument, AdPlatform, AdAccountStatus } from '../schemas/ad-account.schema';
import { AdGroup, AdGroupDocument, AdGroupStatus } from '../schemas/ad-group.schema';
import { AdCost, AdCostDocument } from '../schemas/ad-cost.schema';
import { Fanpage, FanpageDocument } from '../../chatbot/schemas/fanpage.schema';
import { ApiToken, ApiTokenStatus, ApiTokenDocument, ApiTokenType } from '../schemas/api-token.schema';
import { IAdPlatformService, BusinessTokenSyncResult } from './ad-platform.interface';
import { BaseAdPlatformService } from './base-ad-platform.service';
`;

  const constructor = `
  constructor(
    @InjectModel(AdAccount.name) adAccountModel: Model<AdAccountDocument>,
    @InjectModel(AdGroup.name) adGroupModel: Model<AdGroupDocument>,
    @InjectModel(Fanpage.name) fanpageModel: Model<FanpageDocument>,
    @InjectModel(AdCost.name) adCostModel: Model<AdCostDocument>,
    @InjectModel(ApiToken.name) apiTokenModel: Model<ApiTokenDocument>,
    configService: ConfigService,
  ) {
    super(adAccountModel, adGroupModel, fanpageModel, adCostModel, apiTokenModel, configService);
  }
`;

  // Strip existing imports
  content = content.replace(/import\s+[\s\S]*?from\s+['"].*?['"];/g, '');
  content = content.replace(/import\s+.*?;/g, ''); 

  // Make class extend and inject constructor
  content = content.replace(
    new RegExp(`export\\s+class\\s+${className}[^{]*?\\{`),
    `@Injectable()\nexport class ${className} extends BaseAdPlatformService implements IAdPlatformService {\n${constructor}`
  );
  
  // Collapse duplicate injectables safely
  content = content.replace(/@Injectable\(\)[\s\n]*@Injectable\(\)/g, '@Injectable()\n');
  content = imports + '\n' + content;
  fs.writeFileSync(filename, content);
  console.log('Fixed', filename);
}

fixFile('facebook-ads.service.ts', 'FacebookAdsProvider');
fixFile('google-ads.service.ts', 'GoogleAdsProvider');
