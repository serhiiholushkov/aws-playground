import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

export interface CognitoStackProps extends cdk.StackProps {
  envName: string;
}

export class CognitoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CognitoStackProps) {
    super(scope, id, props);

    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `aws-playground-${props.envName}-user-pool`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(7),
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // for playground only.
      userVerification: {
        emailSubject: `Verify your email for AWS Cognito Playground (${props.envName})`,
        emailBody:
          'Hello {username},<br><br>Please verify your email by clicking the link below:<br><a href="{##Verify Email##}">Verify Email</a><br><br>Thank you!',
        emailStyle: cognito.VerificationEmailStyle.LINK,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_AND_PHONE_WITHOUT_MFA,
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      userPoolClientName: `aws-playground-${props.envName}-user-pool-client`,
      authFlows: {
        userPassword: true, // for testing purposes only. In production, consider using more secure flows like SRP or OIDC.
        userSrp: true, // recommended for browser/mobile clients to avoid sending plaintext passwords
        adminUserPassword: true, // ADMIN_USER_PASSWORD_AUTH — backend-only flow (e.g., using AWS SDK with admin credentials).
      },
      generateSecret: false, // must be 'false' for browser/mobile clients
    });

    // Output the User Pool ID and Client ID for use in the application
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, 'Region', { value: this.region });
  }
}
