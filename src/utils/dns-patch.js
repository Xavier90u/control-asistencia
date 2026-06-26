const dns = require('dns');

const SRV_RECORDS = {
  '_mongodb._tcp.cluster0.cjquwrj.mongodb.net': [
    { priority: 0, weight: 0, port: 27017, name: 'ac-o1beve5-shard-00-00.cjquwrj.mongodb.net' },
    { priority: 0, weight: 0, port: 27017, name: 'ac-o1beve5-shard-00-01.cjquwrj.mongodb.net' },
    { priority: 0, weight: 0, port: 27017, name: 'ac-o1beve5-shard-00-02.cjquwrj.mongodb.net' },
  ],
};

const A_RECORDS = {
  'ac-o1beve5-shard-00-00.cjquwrj.mongodb.net': ['89.192.95.162'],
  'ac-o1beve5-shard-00-01.cjquwrj.mongodb.net': ['89.193.227.167'],
  'ac-o1beve5-shard-00-02.cjquwrj.mongodb.net': ['89.193.39.22'],
  'cluster0.cjquwrj.mongodb.net': ['89.192.95.162'],
};

function patchDns() {
  // Patch callback-based dns
  const origResolveSrv = dns.resolveSrv.bind(dns);
  dns.resolveSrv = function (hostname, callback) {
    if (SRV_RECORDS[hostname]) {
      return callback(null, SRV_RECORDS[hostname]);
    }
    return origResolveSrv(hostname, callback);
  };

  const origResolve4 = dns.resolve4.bind(dns);
  dns.resolve4 = function (hostname, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    if (A_RECORDS[hostname]) {
      return callback(null, A_RECORDS[hostname]);
    }
    return origResolve4(hostname, options, callback);
  };

  // Patch promise-based dns (used by MongoDB driver)
  if (dns.promises) {
    const origPromiseResolveSrv = dns.promises.resolveSrv.bind(dns.promises);
    dns.promises.resolveSrv = function (hostname) {
      if (SRV_RECORDS[hostname]) {
        return Promise.resolve(SRV_RECORDS[hostname]);
      }
      return origPromiseResolveSrv(hostname);
    };

    const origPromiseResolve4 = dns.promises.resolve4.bind(dns.promises);
    dns.promises.resolve4 = function (hostname, options) {
      if (A_RECORDS[hostname]) {
        return Promise.resolve(A_RECORDS[hostname]);
      }
      return origPromiseResolve4(hostname, options);
    };
  }

  console.log('DNS patch applied for MongoDB Atlas SRV resolution');
}

module.exports = { patchDns };
