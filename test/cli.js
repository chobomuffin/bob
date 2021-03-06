/*
var _ = require('underscore'),
  bag = require('bagofholding'),
  p = require('path'),
  sandbox = require('sandboxed-module'),
  should = require('should'),
  checks, mocks,
  cli;

describe('cli', function () {

  function create(checks, mocks) {
    return sandbox.require('../lib/cli', {
      locals: {
        __dirname: '/app/bob/lib'
      },
      requires: {
        bagofholding: {
          cli: {
            parse: function (commands, dirname) {
              checks.bag_cli_parse_commands = commands;
              checks.bag_cli_parse_dirname = dirname;
            },
            exit: bag.cli.exit
          }
        },
        fs: bag.mock.fs(checks, mocks),
        './bob': function (dir, tools, custom, pkg) {
          checks.bob_dir = dir;
          checks.bob_tools = tools;
          checks.bob_custom = custom;
          checks.bob_pkg = pkg;
          return {
            external: function (targets, mode, verbose, cb) {
              checks.bob_external_targets = targets;
              checks.bob_external_mode = mode;
              checks.bob_external_verbose = verbose;
              cb(mocks.bob_external_err, mocks.bob_external_result);
            },
            internal: function (target, opts, cb) {
              checks.bob_internal_target = target;
              checks.bob_internal_opts = opts;
              checks.bob_internal_cb = cb;
            }
          };
        }
      },
      globals: {
        console: bag.mock.console(checks),
        process: bag.mock.process(checks, mocks)
      }
    });
  }

  beforeEach(function () {
    checks = {};
    mocks = {
      process_cwd: '/curr/dir',
      'fs_readFileSync_/app/bob/conf/tools.json': '{ "foo": "bar" }'
    };
  });

  describe('exec', function () {

    it('should pass internal targets to bob functions', function () {
      mocks.process_argv = ['node', 'bob', '_versionup'];
      mocks.process_env = { BOB_MODE: 'robot' };
      mocks['fs_readFileSync_/app/bob/package.json'] = '{ "name": "thebob", "version": "1.2.3" }';
      cli = create(checks, mocks);
      cli.exec();

      // not passed to bob build
      should.not.exist(checks.bob_external_targets);

      // private commands are parsed
      _.keys(checks.bag_cli_parse_commands).length.should.equal(5);
      _.keys(checks.bag_cli_parse_commands)[0].should.equal('_updep');
      _.keys(checks.bag_cli_parse_commands)[1].should.equal('_versionup');
      _.keys(checks.bag_cli_parse_commands)[2].should.equal('_versionup-minor');
      _.keys(checks.bag_cli_parse_commands)[3].should.equal('_versionup-major');
      _.keys(checks.bag_cli_parse_commands)[4].should.equal('_template');

      // internal targets delegate to bob
      checks.bag_cli_parse_commands._updep.action();
      checks.bob_internal_target.should.equal('updep');
      (typeof checks.bob_internal_cb).should.equal('function');
      checks.bag_cli_parse_commands._versionup.action();
      checks.bob_internal_target.should.equal('versionup');
      should.not.exist(checks.bob_internal_opts.type);
      (typeof checks.bob_internal_cb).should.equal('function');
      checks.bag_cli_parse_commands['_versionup-minor'].action();
      checks.bob_internal_target.should.equal('versionup');
      checks.bob_internal_opts.type.should.equal('minor');
      (typeof checks.bob_internal_cb).should.equal('function');
      checks.bag_cli_parse_commands['_versionup-major'].action();
      checks.bob_internal_target.should.equal('versionup');
      checks.bob_internal_opts.type.should.equal('major');
      (typeof checks.bob_internal_cb).should.equal('function');
      checks.bag_cli_parse_commands._template.action();
      checks.bob_internal_target.should.equal('template');
      (typeof checks.bob_internal_cb).should.equal('function');
    });

    it('should pass external targets, mode and verbosity, to bob build function when there is only a single public target', function () {
      mocks.process_argv = ['node', 'bob', 'lint'];
      mocks.process_env = { BOB_MODE: 'robot' };
      mocks['fs_readFileSync_/app/bob/package.json'] = '{ "name": "thebob", "version": "1.2.3" }';
      cli = create(checks, mocks);
      cli.exec();
      checks.bob_external_targets.length.should.equal(1);
      checks.bob_external_targets[0].should.equal('lint');
      checks.bob_external_mode.should.equal('robot');
      checks.bob_external_verbose.should.equal(false);
    });

    it('should pass external targets, mode and verbosity, to bob build function when there are multiple public targets', function () {
      mocks.process_argv = ['node', 'bob', 'lint', 'style', 'test'];
      mocks.process_env = { BOB_MODE: 'robot' };
      mocks['fs_readFileSync_/app/bob/package.json'] = '{ "name": "thebob", "version": "1.2.3" }';
      cli = create(checks, mocks);
      cli.exec();
      checks.bob_external_targets.length.should.equal(3);
      checks.bob_external_targets[0].should.equal('lint');
      checks.bob_external_targets[1].should.equal('style');
      checks.bob_external_targets[2].should.equal('test');
      checks.bob_external_mode.should.equal('robot');
      checks.bob_external_verbose.should.equal(false);
    });

    it('should set verbosity to true when --verbose flag is set', function () {
      mocks.process_argv = ['node', 'bob', '--verbose', 'lint', 'style', 'test'];
      mocks.process_env = { BOB_MODE: 'robot' };
      mocks['fs_readFileSync_/app/bob/package.json'] = '{ "name": "thebob", "version": "1.2.3" }';
      cli = create(checks, mocks);
      cli.exec();
      checks.bob_external_verbose.should.equal(true);
    });

    it('should set verbosity to false when --verbose flag is not set', function () {
      mocks.process_argv = ['node', 'bob', 'lint', 'style', 'test'];
      mocks.process_env = { BOB_MODE: 'robot' };
      mocks['fs_readFileSync_/app/bob/package.json'] = '{ "name": "thebob", "version": "1.2.3" }';
      cli = create(checks, mocks);
      cli.exec();
      checks.bob_external_verbose.should.equal(false);
    });

    it('should log failure message and exit code when public command passes an error', function () {
      mocks.bob_external_err = new Error('someerror');
      mocks.bob_external_result = 1;
      mocks.process_argv = ['node', 'bob', 'lint'];
      mocks.process_env = { BOB_MODE: 'robot' };
      cli = create(checks, mocks);
      cli.exec();
      checks.bob_external_targets.length.should.equal(1);
      checks.bob_external_targets[0].should.equal('lint');
      checks.console_error_messages.length.should.equal(1);
      checks.console_error_messages[0].should.equal('FAILURE | exit code: 1');
    });

    it('should log success message and exit code when public command passes no error', function () {
      mocks.bob_external_result = 0;
      mocks.process_argv = ['node', 'bob', 'lint'];
      mocks.process_env = { BOB_MODE: 'robot' };
      cli = create(checks, mocks);
      cli.exec();
      checks.bob_external_targets.length.should.equal(1);
      checks.bob_external_targets[0].should.equal('lint');
      checks.console_log_messages.length.should.equal(1);
      checks.console_log_messages[0].should.equal('SUCCESS | exit code: 0');
    });

    it('should pass empty custom and pkg configs when .bob.json and package.json files exist in current directory', function () {
      mocks['fs_existsSync_/curr/dir/package.json'] = true;
      mocks['fs_existsSync_/curr/dir/.bob.json'] = true;
      mocks.process_argv = ['node', 'bob', 'lint'];
      mocks.process_env = { BOB_MODE: 'robot' };
      mocks['fs_readFileSync_/app/bob/package.json'] = '{ "name": "thebob", "version": "1.2.3" }';
      mocks['fs_readFileSync_/curr/dir/package.json'] = '{ "name": "someapp", "version": "1.2.3" }';
      mocks['fs_readFileSync_/curr/dir/.bob.json'] = '{ "test": { "type": "vows" } }';
      cli = create(checks, mocks);
      cli.exec();
      checks.bob_pkg.name.should.equal('someapp');
      checks.bob_pkg.version.should.equal('1.2.3');
      checks.bob_custom.test.type.should.equal('vows');
    });

    it('should not set custom and pkg configs when .bob.json and package.json do not exist', function () {
      mocks['fs_existsSync_/curr/dir/package.json'] = false;
      mocks['fs_existsSync_/curr/dir/.bob.json'] = false;
      mocks.process_argv = ['node', 'bob', 'lint'];
      mocks.process_env = { BOB_MODE: 'robot' };
      mocks['fs_readFileSync_/app/bob/package.json'] = '{ "name": "thebob", "version": "1.2.3" }';
      cli = create(checks, mocks);
      cli.exec();
      should.not.exist(checks.bob_pkg);
      should.not.exist(checks.bob_custom);
    });

    it('should throw error when .bob.json contains invalid JSON', function () {
      mocks['fs_existsSync_/curr/dir/package.json'] = true;
      mocks['fs_existsSync_/curr/dir/.bob.json'] = true;
      mocks.process_argv = ['node', 'bob', 'lint'];
      mocks.process_env = { BOB_MODE: 'robot' };
      mocks['fs_readFileSync_/app/bob/package.json'] = '{ "name": "thebob", "version": "1.2.3" }';
      mocks['fs_readFileSync_/curr/dir/package.json'] = '{ "name": "someapp", "version": "1.2.3" }';
      mocks['fs_readFileSync_/curr/dir/.bob.json'] = '{{{{ "test": { "type": "vows" } }';
      cli = create(checks, mocks);
      try {
        cli.exec();
      } catch (e) {
        e.type.should.equal('unexpected_token');
        e.message.should.equal('Unexpected token {');
      }
      checks.console_error_messages.length.should.equal(1);
      checks.console_error_messages[0].should.equal('Invalid JSON file - /curr/dir/.bob.json');
    });

    it('should throw error when package.json contains invalid JSON', function () {
      mocks['fs_existsSync_/curr/dir/package.json'] = true;
      mocks['fs_existsSync_/curr/dir/.bob.json'] = true;
      mocks.process_argv = ['node', 'bob', 'lint'];
      mocks.process_env = { BOB_MODE: 'robot' };
      mocks['fs_readFileSync_/app/bob/package.json'] = '{ "name": "thebob", "version": "1.2.3" }';
      mocks['fs_readFileSync_/curr/dir/package.json'] = '{{{{ "name": "someapp", "version": "1.2.3" }';
      mocks['fs_readFileSync_/curr/dir/.bob.json'] = '{ "test": { "type": "vows" } }';
      cli = create(checks, mocks);
      try {
        cli.exec();
      } catch (e) {
        e.type.should.equal('unexpected_token');
        e.message.should.equal('Unexpected token {');
      }
      checks.console_error_messages.length.should.equal(1);
      checks.console_error_messages[0].should.equal('Invalid JSON file - /curr/dir/package.json');
    });

    it('should pass empty custom config when there is no .bob.json file in current directory', function () {
      mocks['fs_existsSync_/curr/dir/package.json'] = true;
      mocks['fs_existsSync_/curr/dir/.bob.json'] = false; 
      mocks.process_argv = ['node', 'bob', 'lint'];
      mocks.process_env = { BOB_MODE: 'robot' };
      mocks['fs_readFileSync_/app/bob/package.json'] = '{ "name": "thebob", "version": "1.2.3" }';
      mocks['fs_readFileSync_/curr/dir/package.json'] = '{ "name": "someapp", "version": "1.2.3" }';
      cli = create(checks, mocks);
      cli.exec();
      checks.bob_pkg.name.should.equal('someapp');
      checks.bob_pkg.version.should.equal('1.2.3');
      should.not.exist(checks.bob_custom);
    });

    it('should pass empty pkg config when there is no package.json file in current directory', function () {
      mocks['fs_existsSync_/curr/dir/package.json'] = false;
      mocks['fs_existsSync_/curr/dir/.bob.json'] = true; 
      mocks.process_argv = ['node', 'bob', 'lint'];
      mocks.process_env = { BOB_MODE: 'robot' };
      mocks['fs_readFileSync_/app/bob/package.json'] = '{ "name": "thebob", "version": "1.2.3" }';
      mocks['fs_readFileSync_/curr/dir/.bob.json'] = '{ "test": { "type": "vows" } }';
      cli = create(checks, mocks);
      cli.exec();
      should.not.exist(checks.bob_pkg);
      checks.bob_custom.test.type.should.equal('vows');
    });
  });
});
*/