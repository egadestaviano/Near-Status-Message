import "regenerator-runtime/runtime";
import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Big from "big.js";
import Form from "./components/Form";

const BOATLOAD_OF_GAS = Big(3).times(10 ** 13).toFixed();

const App = ({ contract, currentUser, nearConfig, wallet }) => {
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [publicFeed, setPublicFeed] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    if (currentUser) {
      // Fetch current status
      contract.get_status({
        account_id: currentUser.accountId
      }).then(status => {
        setStatus(status);
      });

      // Fetch status history
      contract.get_status_history({
        account_id: currentUser.accountId
      }).then(history => {
        setHistory(history);
      });

      // Fetch public feed
      contract.get_public_feed().then(feed => {
        setPublicFeed(feed);
      });
    }
  }, [currentUser]);

  const onSubmit = async event => {
    event.preventDefault();

    const { fieldset, message } = event.target.elements;
    
    // Validate message length before submitting
    if (message.value.length > 280) {
      alert("Message must be 280 characters or less!");
      return;
    }
    
    fieldset.disabled = true;

    await contract.set_status(
      {
        message: message.value
      },
      BOATLOAD_OF_GAS
    );

    const status = await contract.get_status({
      account_id: currentUser.accountId
    });

    const history = await contract.get_status_history({
      account_id: currentUser.accountId
    });

    const feed = await contract.get_public_feed();

    setStatus(status);
    setHistory(history);
    setPublicFeed(feed);

    message.value = "";
    fieldset.disabled = false;
    message.focus();
  };

  // New function to delete status
  const onDelete = async event => {
    event.preventDefault();

    const { fieldset } = event.target.form.elements;
    fieldset.disabled = true;

    await contract.delete_status(
      {},
      BOATLOAD_OF_GAS
    );

    const history = await contract.get_status_history({
      account_id: currentUser.accountId
    });

    const feed = await contract.get_public_feed();

    setStatus(null);
    setHistory(history);
    setPublicFeed(feed);

    fieldset.disabled = false;
  };

  const signIn = () => {
    wallet.requestSignIn(
      nearConfig.contractName,
      "NEAR Status Message"
    );
  };

  const signOut = () => {
    wallet.signOut();
    window.location.replace(window.location.origin + window.location.pathname);
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp / 1000000); // Convert nanoseconds to milliseconds
    return date.toLocaleString();
  };

  // Handle search
  const handleSearch = async (event) => {
    event.preventDefault();
    
    if (searchTerm.trim() === "") {
      setSearchResults([]);
      return;
    }
    
    const results = await contract.search_statuses({
      keyword: searchTerm
    });
    
    setSearchResults(results);
  };

  return (
    <main>
      <header>
        <h1>NEAR Status Message</h1>

        {currentUser ?
          <p>Currently signed in as: <code>{currentUser.accountId}</code></p>
        :
          <p>Update or add a status message! Please login to continue.</p>
        }

        { currentUser
          ? <button onClick={signOut}>Log out</button>
          : <button onClick={signIn}>Log in</button>
        }
      </header>

      {currentUser &&
        <Form
          onSubmit={onSubmit}
          currentUser={currentUser}
        />
      }

      {status ?
        <>
          <p>Your current status:</p>
          <p>
            <code>
              {status.message}
            </code>
          </p>
          <p className="timestamp">Posted: {formatTimestamp(status.timestamp)}</p>
          <button onClick={onDelete}>Delete status</button>
        </>
      :
        <p>No status message yet!</p>
      }

      {/* Status History Section */}
      {history.length > 0 && (
        <section>
          <h2>Your Status History</h2>
          <ul>
            {history.map((item, index) => (
              <li key={index}>
                <code>{item.message}</code>
                <span className="timestamp"> ({formatTimestamp(item.timestamp)})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Search Section */}
      <section>
        <h2>Search Public Statuses</h2>
        <form onSubmit={handleSearch}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Enter keyword to search..."
          />
          <button type="submit">Search</button>
        </form>
        
        {searchResults.length > 0 ? (
          <ul>
            {searchResults.map(([account, item], index) => (
              <li key={index}>
                <strong>{account}:</strong> <code>{item.message}</code>
                <span className="timestamp"> ({formatTimestamp(item.timestamp)})</span>
              </li>
            ))}
          </ul>
        ) : searchTerm !== "" ? (
          <p>No results found for "{searchTerm}"</p>
        ) : null}
      </section>

      {/* Public Feed Section */}
      <section>
        <h2>Public Status Feed</h2>
        {publicFeed.length > 0 ? (
          <ul>
            {publicFeed.map(([account, item], index) => (
              <li key={index}>
                <strong>{account}:</strong> <code>{item.message}</code>
                <span className="timestamp"> ({formatTimestamp(item.timestamp)})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No public statuses yet!</p>
        )}
      </section>
    </main>
  );
};

App.propTypes = {
  contract: PropTypes.shape({
    set_status: PropTypes.func.isRequired,
    get_status: PropTypes.func.isRequired,
    get_status_history: PropTypes.func.isRequired,
    get_public_feed: PropTypes.func.isRequired,
    search_statuses: PropTypes.func.isRequired,
    delete_status: PropTypes.func.isRequired
  }).isRequired,
  currentUser: PropTypes.shape({
    accountId: PropTypes.string.isRequired,
    balance: PropTypes.string.isRequired
  }),
  nearConfig: PropTypes.shape({
    contractName: PropTypes.string.isRequired
  }).isRequired,
  wallet: PropTypes.shape({
    requestSignIn: PropTypes.func.isRequired,
    signOut: PropTypes.func.isRequired
  }).isRequired
};

export default App;