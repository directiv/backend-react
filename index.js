/**
 * Module dependencies
 */

var React = require('react');
var DOM = React.DOM;
var Router = require('react-router');
var Syrinx = require('syrinx');

var Link = Router.Link;
var Routes = Router.Routes
var Route = Router.Route;
var RouteDefault = Router.DefaultRoute;
var RouteNotFound = Router.NotFoundRoute;
var RouteRedirect = Route.Redirect;

// TODO implement the error route
function RouteError() {
  return Route.apply(this, arguments);
};

exports = module.exports = function(mount, opts) {
  return init.bind(null, mount, opts);
};

function createTemplate(template) {
  if (!template) return;
  return function(state) {
    var out = template(state);
    // TODO should we have a loading page?
    // if (!out) return DOM.div(null, 'TODO get a loading state!');
    return DOM.div({className: 'template-root'}, out);
  };
}

/**
 * Create a generic handler class
 */

var Handler = React.createClass({
  displayName: 'DirectivTemplate',
  getInitialState: function() {
    return {
      template: createTemplate(this.props.module)
    };
  },
  componentWillReceiveProps: function(next) {
    this.setState({
      template: createTemplate(next.module)
    });
    return true;
  },
  render: function() {
    var template = this.state.template;
    if (!template) return DOM.div(null, 'Missing "module" property');

    // TODO pass the route parameters
    var state = {
      __activeRouteHandler: this.props.activeRouteHandler
    };

    if (process.env.NODE_ENV === 'development') return template(state);

    try {
      return template(state);
    } catch (err) {
      // TODO handle errors gracefully
      console.log(err);
      return DOM.pre({}, err.stack || err.message);
    };
  }
});

function createContainer(app) {
  var modules = new Syrinx('directiv-backend-react');
  for (var name in DOM) {
    registerElement(modules, name, DOM[name]);
  }
  modules.register('el-apply', function() {
    return function(el) {
      var fn = el.state.get('__activeRouteHandler');
      return fn && fn();
    };
  });
  modules.register('href', function() {
    this.compile = function(input) {
      return {
        absolute: /^(?:[a-z]+:)?\/\//i.test(input),
        name: input
      };
    };

    this.tag = function(conf, state, tag) {
      return conf.absolute ? tag : 'link';
    };

    this.props = function(conf, state, props) {
      return conf.absolute ? props : props.set('to', conf.name);
    };
  });

  modules.register('el-link', function() {
    return function(el) {
      var props = el.props;
      // they complain about passing properties here... booo
      props.className = props.class;
      delete props.class;
      var newProps = {
        to: props.to,
        params: props
      };
      return Link(newProps, el.children);
    };
  });

  modules.register('$app', function() {
    return app;
  });

  return modules;
}

function init(mount, opts, routes, app) {
  var modules = createContainer(app);
  var DirectivRouter = React.createClass({
    displayName: 'DirectivRouter',
    getInitialState: function() {
      return {
        render: toRenderFn(modules, Handler, routes)
      };
    },
    componentWillMount: function() {
      var self = this;
      app.on('change', function(routes) {
        self.setState({error: null});
      });
      app.on('update', function(routes) {
        self.setState({render: toRenderFn(modules, Handler, routes), error: null});
      });
      app.on('error', function(err) {
        setTimeout(function() {
          self.setState({error: err});
        }, 100);
        throw err;
      });
    },
    render: function() {
      if (!this.state.error) return this.state.render();
      console.error(this.state.error);
      return DOM.pre(null, this.state.error.stack);
    }
  });

  return React.renderComponent(DirectivRouter(), mount);
};

function toRenderFn(modules, Handler, routes) {
  var convert = Convert.bind(null, Handler);
  return routes(modules,
                convert(Routes),
                convert(Route),
                convert(RouteDefault),
                convert(RouteError),
                convert(RouteNotFound),
                convert(RouteRedirect));
}

function Convert(Handler, Klass) {
  return function(props) {
    props.handler = Handler;
    return Klass.apply(null, arguments);
  };
}

/**
 * Regiser the built-in elements
 */

function registerElement(modules, name, fn) {
  modules.register('el-' + name, function() {
    return function(el) {
      var props = el.props;
      var className = props.class || '';
      if (el.__pending) className += ' data-pending';
      else className += ' data-loaded';
      props.className = className;
      delete props.class;
      el.props.__state = el.state;
      return fn(el.props, el.children);
    };
  });
}

if ('production' !== process.env.NODE_ENV) {
  // Enable React devtools
  window['React'] = React;
}
