const fs = require('fs');

function fixFile(filename, className) {
  let content = fs.readFileSync(filename, 'utf8');
  
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

  if (!content.includes('constructor(')) {
    // Remove all existing import statements because we provided a comprehensive replacement above
    content = content.replace(/import\s+.*?;/g, ''); 
    content = content.replace(/import\s+[\s\S]*?from\s+['"].*?['"];/g, '');

    content = content.replace(
      new RegExp('export class ' + className + ' .*? {'),
      '@Injectable()\nexport class ' + className + ' extends BaseAdPlatformService implements IAdPlatformService {\n' + constructor
    );
    
    // Some classes might not have decorators anymore, so ensure only one Injectable
    content = content.replace(/@Injectable\(\)[\s\n]*@Injectable\(\)/g, '@Injectable()\n');
    
    content = imports + '\n' + content;
    fs.writeFileSync(filename, content);
    console.log('Fixed', filename);
  } else {
    console.log('Already has constructor:', filename);
  }
}

fixFile('facebook-ads.service.ts', 'FacebookAdsProvider');
fixFile('google-ads.service.ts', 'GoogleAdsProvider');
fixFile('tiktok-ads.service.ts', 'TikTokAdsProvider');

