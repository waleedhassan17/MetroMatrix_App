// Tests run with the device clock in New York (UTC−4/−5), not Pakistan, so
// any code that formats appointment or order times in the DEVICE's zone
// instead of the practice's (utils/healthTime) fails here rather than for a
// patient abroad. Workers inherit this from the parent process.
module.exports = async () => {
  process.env.TZ = 'America/New_York';
};
