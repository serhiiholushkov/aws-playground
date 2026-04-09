#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { CognitoStack } from '../lib/cognito-stack';
import { Environment } from 'aws-cdk-lib/aws-appconfig';

const app = new cdk.App();

const awsEnv: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

const env = 'dev';

const sharedTags = { Project: 'AWSPlayground', Environment: env };
const prefix = 'aws-playground';

new CognitoStack(app, `${prefix}-cognito`, {
  env: awsEnv,
  envName: env,
  tags: sharedTags,
});
