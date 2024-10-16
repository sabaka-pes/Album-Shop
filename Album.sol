// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './AlbumTracker.sol'; 

contract Album {
    uint public price; // Album price
    string public title; // Album title
    bool public purchased; // To check if purchased
    uint public index; // Album index in tracker
    AlbumTracker tracker; // The parent contract will be stored in this variable


    constructor(uint _price, string memory _title, uint _index, AlbumTracker _tracker) {
        price = _price;
        title = _title;
        index = _index;
        tracker = _tracker;
    }

    // Payment receiving function
    receive() external payable {
        // To avoid selling the same product twice
        require(!purchased, "This album is already purchased!");
        // Check for full price
        require(price == msg.value, "We accept only full payments!");
        // Calling AlbumTracker function 
        (bool success, ) = address(tracker).call{value: msg.value}(abi.encodeWithSignature("triggerPayment(uint256)", index));
        require(success, "Sorry, we could not process your transaction.");
        // Mark as purchased
        purchased = true;
    }
}