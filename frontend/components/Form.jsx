import React, { useState } from 'react';
import PropTypes from 'prop-types';

export default function Form({ onSubmit, currentUser }) {
  const [message, setMessage] = useState('');

  const handleMessageChange = (e) => {
    // Limit to 280 characters
    if (e.target.value.length <= 280) {
      setMessage(e.target.value);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <fieldset id="fieldset">
        <p>Add or update your status message!</p>
        <p className="highlight">
          <label htmlFor="message">Message:</label>
          <input
            autoComplete="off"
            autoFocus
            id="message"
            required
            value={message}
            onChange={handleMessageChange}
          />
        </p>
        <p className="character-count">{message.length}/280</p>
        <button type="submit">
          Update
        </button>
      </fieldset>
    </form>
  );
}

Form.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  currentUser: PropTypes.shape({
    accountId: PropTypes.string.isRequired
  })
};