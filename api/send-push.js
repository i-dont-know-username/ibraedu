const webpush = require('web-push');

const VAPID_KEYS = {
  publicKey: 'BPPeYA-ivlAKNi0HRq8qmmU5PhejzMkML73KX_1HpyT1-gTYrM_Czlex55fmhbmyUNZCpKiRalC-NvdXj_6JxPE',
  privateKey: '-gTYrM_Czlex55fmhbmyUNZCpKiRalC-NvdXj_6JxPE'
};

webpush.setVapidDetails(
  'mailto:ibraedu@example.com',  // replace with a valid contact email
  VAPID_KEYS.publicKey,
  VAPID_KEYS.privateKey
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { subscriptions, notification } = req.body;
  if (!subscriptions || !Array.isArray(subscriptions) || !notification) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  const pushPayload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    url: notification.url || '/'
  });

  const sendPromises = subscriptions.map(sub =>
    webpush.sendNotification(sub, pushPayload).catch(err => {
      // If subscription is invalid, log it (in production you might remove it)
      console.error('Push failed for', sub.endpoint, err.statusCode);
    })
  );

  await Promise.all(sendPromises);
  res.status(200).json({ success: true });
};
