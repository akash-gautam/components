/*
* Event Gateway: Deploy
*/

const utils = require('../utils')

module.exports = async (inputs, context) => {
  // Set defaults
  context.state = context.state || {}
  context.state.events = context.state.events || {}
  context.state.functions = context.state.functions || {}
  context.state.subscriptions = context.state.subscriptions || {}
  context.state.cors = context.state.cors || {}

  // Configure EventGateway SDK instance
  utils.configEventGateway(inputs.accessKey, inputs.space)

  // Register Functions
  for (var f in inputs.functions) {
    // Add 'metadata' to track which service created these resources
    inputs.functions[f].metadata = {
      serviceId: context.serviceId
    }

    inputs.functions[f].type = inputs.functions[f].type.toLowerCase()
    try {
      context.state.functions[f] = await utils.createOrUpdateFunction(inputs.functions[f])
    } catch (err) {
      throw new Error(err.message)
    }
    context.saveState(context.state)
  }

  // Register Events
  for (var e in inputs.events) {
    // Add 'metadata' to track which service created these resources
    inputs.events[e].metadata = {
      serviceId: context.serviceId
    }

    try {
      context.state.events[e] = await utils.createOrUpdateEvent(inputs.events[e])
    } catch (err) {
      throw new Error(err.message)
    }
    context.saveState(context.state)
  }

  // Register Subscriptions
  for (var e in inputs.subscriptions) {
    context.state.subscriptions[e] = context.state.subscriptions[e] || {}

    for (var f in inputs.subscriptions[e]) {
      // If exists, add subscription ID to trigger update
      let subscriptionID = null
      if (context.state.subscriptions[e] && context.state.subscriptions[e][f]) {
        subscriptionID = context.state.subscriptions[e][f].subscriptionId
      }
      // Sanitize Path - If no path, set default
      if (!inputs.subscriptions[e][f].path) {
        inputs.subscriptions[e][f].path = `/${inputs.space}/`
      }
      // Sanitize Path - If doesn't start with '/', add it
      if (!inputs.subscriptions[e][f].path.startsWith('/')) {
        inputs.subscriptions[e][f].path = '/' + inputs.subscriptions[e][f].path
      }
      // Sanitize Path - If doesn't start with '/' + space, add it
      if (!inputs.subscriptions[e][f].path.startsWith('/' + inputs.space)) {
        inputs.subscriptions[e][f].path = '/' + inputs.space + inputs.subscriptions[e][f].path
      }

      // Add 'metadata' to track which service created these resources
      inputs.subscriptions[e][f].metadata = {
        serviceId: context.serviceId
      }

      try {
        context.state.subscriptions[e][f] = await utils.createOrUpdateSubscription(
          inputs.subscriptions[e][f],
          subscriptionID
        )
      } catch (err) {
        // Add better error message to include Event, Function, Path, Method
        if (err.message.includes('already exists')) {
          err.message = `${err.message} - Event: "${e}", Function: "${f}", Path: "${inputs.subscriptions[e][f].path}", Method: "${inputs.subscriptions[e][f].method}"` // eslint-disable-line
        }
        throw new Error(err.message)
      }

      context.saveState(context.state)

      // Update CORS
      // TODO: Determine how to handle this across many subscriptions using the same path + method
      let subPath = inputs.subscriptions[e][f].path
      let subMethod = inputs.subscriptions[e][f].method
      let cors = {
        // Defaults to open
        method: subMethod,
        path: subPath,
        allowedOrigins: ['*'],
        allowedMethods: ['POST', 'GET', 'PUT', 'DELETE'],
        allowedHeaders: ['Origin', 'Accept', 'Content-Type'],
        allowCredentials: false
      }
      if (inputs.subscriptions[e][f].cors) {
        cors.allowedOrigins = inputs.subscriptions[e][f].cors.allowedOrigins || cors.allowedOrigins
        cors.allowedMethods = inputs.subscriptions[e][f].cors.allowedMethods || cors.allowedMethods
        cors.allowedHeaders = inputs.subscriptions[e][f].cors.allowedHeaders || cors.allowedHeaders
        cors.allowCredentials =
          inputs.subscriptions[e][f].cors.allowCredentials || cors.allowCredentials
      }
      context.state.cors[subPath] = context.state.cors[subPath] || {}
      // Merge with existing CORS config, if exists
      if (context.state.cors[subPath][subMethod]) {
        cors = Object.assign(context.state.cors[subPath][subMethod], cors)
      }
      try {
        context.state.cors[subPath][subMethod] = await utils.createOrUpdateCORS(cors)
      } catch (err) {
        if (err.message.includes('already exists')) {
          // TODO: Verbose log what's happening
        } else {
          throw new Error(err.message)
        }
      }
      context.saveState(context.state)
    }
  }

  return {
    events: context.state.events,
    functions: context.state.functions,
    subscriptions: context.state.subscriptions
  }
}
