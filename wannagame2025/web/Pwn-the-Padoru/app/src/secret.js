const getSecretData = (req, res) => {
  const decoy = {
    transmission: 'Arcade telemetry uplink engaged.',
    do_you_really_think_this_is_flag: 'CTF{Th1s_1s_4_F4k3_Fl4g_Go_F1nd_Th3_R34l_On3}',
    hint: 'Real pilots check the loot manifests and quest rewards.'
  };

  const encodedSecret = Buffer.from(JSON.stringify(decoy)).toString('base64');
  res.json({ data: encodedSecret });
};

module.exports = {
  getSecretData
};
