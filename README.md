Eventuate AWS Gateway Serverless plugin
=======================================

This is the [Serverless](https://serverless.com/) plugin for [Eventuate](http://eventuate.io/) AWS Gateway.

System requirements:
 - Node.js v4 or later

## Projects that use this plugin

* [Example Java AWS Lambda function for Eventuate](https://github.com/eventuate-examples/eventuate-examples-java-aws-gateway-echo)

## Usage

Put `eventuate-aws-gateway-serverless-plugin` into `plugins` section in the `serverless.yml`

    plugins:
      - eventuate-aws-gateway-serverless-plugin


Add Eventuate AWS Gateway configuration for a lambda function. For example:

    functions:
      testEventHandler:
        handler: handler.eventHandler
        events:
          - eventuate:
              subscriberId: eventuateGatewayPlugin
              space: test
              entitiesAndEventTypes:
                net.chrisrichardson.eventstore.TestEntity:
                  - net.chrisrichardson.eventstore.TestEntityCreated

## Required environment variables

    EVENTUATE_API_KEY_ID
    EVENTUATE_API_KEY_SECRET

## Optional environment variables

    EVENTUATE_GATEWAY_URL
    EVENTUATE_GATEWAY_JWT_TOKEN
    EVENTUATE_GATEWAY_DEBUG

## Commands


View Eventuate AWS Gateway configuration

    sls eventuate-gateway info --gatewayId <gateway ID> --space [space name]

Enable Eventuate AWS Gateway

    sls eventuate-gateway enable  --gatewayId <gateway ID> --space [space name]

Disable Eventuate AWS Gateway

    sls eventuate-gateway disable  --gatewayId <gateway ID> --space [space name]

Delete Eventuate AWS Gateway

    sls eventuate-gateway delete  --gatewayId <gateway ID> --space [space name]

The parameter `space` is set by default to "default", so can be omitted.

See command usage

    sls eventuate-gateway --help
    sls eventuate-gateway <command> --help
