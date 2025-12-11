use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::LookupMap;
use near_sdk::{env, near_bindgen, AccountId};
use std::collections::HashMap;

near_sdk::setup_alloc!();

// Define a struct to hold status message with timestamp
#[derive(BorshDeserialize, BorshSerialize)]
pub struct StatusWithTime {
    message: String,
    timestamp: u64,
}

impl StatusWithTime {
    pub fn new(message: String) -> Self {
        Self {
            message,
            timestamp: env::block_timestamp(),
        }
    }
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize)]
pub struct StatusMessage {
    records: LookupMap<String, StatusWithTime>,
    // Store history of statuses for each user
    history: LookupMap<String, Vec<StatusWithTime>>,
    // Store public feed of recent statuses
    public_feed: Vec<(String, StatusWithTime)>,
}

impl Default for StatusMessage {
    fn default() -> Self {
        Self {
            records: LookupMap::new(b"r".to_vec()),
            history: LookupMap::new(b"h".to_vec()),
            public_feed: Vec::new(),
        }
    }
}

#[near_bindgen]
impl StatusMessage {
    // Modified set_status with character limit and history tracking
    pub fn set_status(&mut self, message: String) {
        // Validate character limit (280 characters like Twitter)
        assert!(message.len() <= 280, "Message must be 280 characters or less");
        
        let account_id = env::signer_account_id();
        let status_with_time = StatusWithTime::new(message.clone());
        
        // Save current status
        self.records.insert(&account_id, &status_with_time);
        
        // Add to history
        let mut user_history = self.history.get(&account_id).unwrap_or_else(|| Vec::new());
        user_history.push(status_with_time.clone());
        // Keep only last 10 statuses in history
        if user_history.len() > 10 {
            user_history.remove(0);
        }
        self.history.insert(&account_id, &user_history);
        
        // Add to public feed
        self.public_feed.push((account_id.clone(), status_with_time));
        // Keep only last 50 statuses in public feed
        if self.public_feed.len() > 50 {
            self.public_feed.remove(0);
        }
    }

    // Modified get_status to return status with timestamp
    pub fn get_status(&self, account_id: String) -> Option<StatusWithTime> {
        return self.records.get(&account_id);
    }
    
    // Get status history for a user
    pub fn get_status_history(&self, account_id: String) -> Vec<StatusWithTime> {
        return self.history.get(&account_id).unwrap_or_else(|| Vec::new());
    }
    
    // Get public feed of recent statuses
    pub fn get_public_feed(&self) -> Vec<(String, StatusWithTime)> {
        return self.public_feed.clone();
    }
    
    // Search public feed for statuses containing a keyword
    pub fn search_statuses(&self, keyword: String) -> Vec<(String, StatusWithTime)> {
        return self.public_feed
            .iter()
            .filter(|(_, status)| status.message.contains(&keyword))
            .cloned()
            .collect();
    }
    
    // New feature: delete status message
    pub fn delete_status(&mut self) {
        let account_id = env::signer_account_id();
        self.records.remove(&account_id);
    }
}

#[cfg(not(target_arch = "wasm32"))]
#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::MockedBlockchain;
    use near_sdk::{testing_env, VMContext};

    fn get_context(input: Vec<u8>, is_view: bool) -> VMContext {
        VMContext {
            current_account_id: "alice_near".to_string(),
            signer_account_id: "bob_near".to_string(),
            signer_account_pk: vec![0, 1, 2],
            predecessor_account_id: "carol_near".to_string(),
            input,
            block_index: 0,
            block_timestamp: 0,
            account_balance: 0,
            account_locked_balance: 0,
            storage_usage: 0,
            attached_deposit: 0,
            prepaid_gas: 10u64.pow(18),
            random_seed: vec![0, 1, 2],
            is_view,
            output_data_receivers: vec![],
            epoch_height: 0,
        }
    }

    #[test]
    fn set_get_message() {
        let context = get_context(vec![], false);
        testing_env!(context);
        let mut contract = StatusMessage::default();
        contract.set_status("hello".to_string());
        let status = contract.get_status("bob_near".to_string()).unwrap();
        assert_eq!("hello".to_string(), status.message);
    }

    #[test]
    fn get_nonexistent_message() {
        let context = get_context(vec![], true);
        testing_env!(context);
        let contract = StatusMessage::default();
        assert_eq!(None, contract.get_status("francis.near".to_string()));
    }

    // New test for delete functionality
    #[test]
    fn delete_message() {
        let context = get_context(vec![], false);
        testing_env!(context);
        let mut contract = StatusMessage::default();
        contract.set_status("hello".to_string());
        let status = contract.get_status("bob_near".to_string()).unwrap();
        assert_eq!("hello".to_string(), status.message);
        
        // Delete the status
        contract.delete_status();
        assert_eq!(None, contract.get_status("bob_near".to_string()));
    }
    
    // Test for character limit validation
    #[test]
    #[should_panic(expected = "Message must be 280 characters or less")]
    fn test_character_limit() {
        let context = get_context(vec![], false);
        testing_env!(context);
        let mut contract = StatusMessage::default();
        let long_message = "a".repeat(300); // Exceeds 280 character limit
        contract.set_status(long_message);
    }
    
    // Test for history tracking
    #[test]
    fn test_history_tracking() {
        let context = get_context(vec![], false);
        testing_env!(context);
        let mut contract = StatusMessage::default();
        
        contract.set_status("first".to_string());
        contract.set_status("second".to_string());
        contract.set_status("third".to_string());
        
        let history = contract.get_status_history("bob_near".to_string());
        assert_eq!(3, history.len());
        assert_eq!("first".to_string(), history[0].message);
        assert_eq!("second".to_string(), history[1].message);
        assert_eq!("third".to_string(), history[2].message);
    }
    
    // Test for public feed
    #[test]
    fn test_public_feed() {
        let context = get_context(vec![], false);
        testing_env!(context);
        let mut contract = StatusMessage::default();
        
        contract.set_status("public message".to_string());
        
        let feed = contract.get_public_feed();
        assert_eq!(1, feed.len());
        assert_eq!("bob_near".to_string(), feed[0].0);
        assert_eq!("public message".to_string(), feed[0].1.message);
    }
    
    // Test for search functionality
    #[test]
    fn test_search_statuses() {
        let context = get_context(vec![], false);
        testing_env!(context);
        let mut contract = StatusMessage::default();
        
        contract.set_status("Hello world".to_string());
        contract.set_status("Rust programming".to_string());
        contract.set_status("Blockchain technology".to_string());
        
        let results = contract.search_statuses("Rust".to_string());
        assert_eq!(1, results.len());
        assert_eq!("Rust programming".to_string(), results[0].1.message);
        
        let results2 = contract.search_statuses("o".to_string());
        assert_eq!(2, results2.len()); // "Hello world" and "Blockchain technology"
    }
}
