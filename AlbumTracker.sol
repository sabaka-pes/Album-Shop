// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './Album.sol';
import "@openzeppelin/contracts/access/Ownable.sol";

// Contract for album tracking
contract AlbumTracker is Ownable { 
    // Event: 
    event AlbumStateChanged(address indexed _albumAddress, uint _albumIndex, uint _stateNum, string _albumTitle);

    constructor() Ownable(msg.sender) {}

    // Album state
    enum AlbumState {
        Created, Paid, Delivered
    }

    struct AlbumProduct {
        Album album;
        AlbumState state;
        uint price;
        string title;
    }

    // Information about album with its index
    mapping(uint => AlbumProduct) public albums;
    uint public currentIndex;

    // Function to create an album (only owner)
    function createAlbum(uint _price, string memory _title) public onlyOwner {
        // When creating an Album we also pass the parent
        Album newAlbum = new Album(_price, _title, currentIndex, this);

        albums[currentIndex].album = newAlbum;
        albums[currentIndex].state = AlbumState.Created;
        albums[currentIndex].price = _price;
        albums[currentIndex].title = _title;

        emit AlbumStateChanged(address(newAlbum), currentIndex, uint(albums[currentIndex].state), _title);

        currentIndex++;
    }

    // Function for payment
    function triggerPayment(uint _index) public payable {
        // To avoid selling the same product twice
        require(albums[_index].state == AlbumState.Created, "This album is already purchased!");
        // Check for full price
        require(albums[_index].price == msg.value, "We accept only full payments!");
        // Change state
        albums[_index].state = AlbumState.Paid;

        emit AlbumStateChanged(address(albums[_index].album), _index, uint(albums[_index].state), albums[_index].title);
    }

    // Function for delivery
    function triggerDelivery(uint _index) public onlyOwner {
        // Check if paid
        require(albums[_index].state == AlbumState.Paid, "This album is not paid for!");
        // Change state
        albums[_index].state = AlbumState.Delivered;

        emit AlbumStateChanged(address(albums[_index].album), _index, uint(albums[_index].state), albums[_index].title);
    }
}