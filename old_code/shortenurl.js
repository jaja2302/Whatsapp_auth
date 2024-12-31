const axios = require('axios');

const shortenURL = async (longUrl) => {
  try {
    const response = await axios.post(
      'https://api.short.io/links',
      {
        originalURL: longUrl,
        domain: 'shorten.srs-ssms.com',
      },
      {
        headers: {
          authorization: process.env.SHORT_IO_API_KEY || 'sk_P6U8oOYoGYIOjgS4',
        },
      }
    );

    if (response.data && response.data.secureShortURL) {
      return response.data.secureShortURL;
    } else {
      throw new Error('Invalid response from short.io API');
    }
  } catch (error) {
    console.error('Error shortening URL:', error.message);
    return longUrl; // Return the original URL if shortening fails
  }
};

module.exports = {
  shortenURL,
};
