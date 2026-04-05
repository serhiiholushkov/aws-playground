# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)
- [AWS CDK Toolkit](https://docs.aws.amazon.com/cdk/latest/guide/cli.html): `npm install -g aws-cdk`

## Setup

### 1. Log in with the profile

```bash
aws login --profile my-profile
```

Verify access:

```bash
aws sts get-caller-identity --profile my-profile
```

### 2. Install dependencies

```bash
npm install
```

### 3. Bootstrap the CDK environment (first time only)

CDK bootstrapping provisions the S3 bucket and IAM roles CDK needs in your account/region:

```bash
npx cdk bootstrap --profile my-profile
```

## Deployment

### Synthesize the CloudFormation template

```bash
npx cdk synth --profile my-profile
```

### Preview changes

```bash
npx cdk diff --profile my-profile
```

### Deploy

```bash
npx cdk deploy --profile my-profile
```

### Destroy the stack

```bash
npx cdk destroy --profile my-profile
```

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `npx cdk deploy` deploy this stack to your default AWS account/region
- `npx cdk diff` compare deployed stack with current state
- `npx cdk synth` emits the synthesized CloudFormation template
