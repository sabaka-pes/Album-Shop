import { loadFixture, ethers, expect } from "./setup";
import { AlbumTracker, Album__factory } from "../typechain-types";
import { ContractTransactionReceipt, BaseContract } from "ethers";

// testing suit
describe("AlbumTracker", function() {
    async function deploy() {
        const [ owner, buyer ] = await ethers.getSigners();

        const AlbumTracker = await ethers.getContractFactory("AlbumTracker");
        
        const tracker = await AlbumTracker.deploy();

        await tracker.waitForDeployment();

        return { tracker, owner, buyer }
    }

    // test: deploying album
    it("deploys album", async function() {
        const { tracker, buyer } = await loadFixture(deploy);

        const albumTitle = "Enchantment of the Ring";
        const albumPrice = ethers.parseEther("0.00005")

        await createAlbum(tracker, albumTitle, albumPrice);

        const expectedAlbumAddr = await precomputeAddress(tracker);

        const album = Album__factory.connect(expectedAlbumAddr, buyer);

        // using chai to check
        expect(await album.price()).to.eq(albumPrice);
        expect(await album.title()).to.eq(albumTitle);
        expect(await album.purchased()).to.be.false;
        expect(await album.index()).to.eq(0);
    });

    // test: creating album
    it("creates album", async function() {
        const { tracker } = await loadFixture(deploy);

        // we need recreate the album because the blockhain clears itself
        const albumTitle = "Enchantment of the Ring";
        const albumPrice = ethers.parseEther("0.00005")

        const receiptTx = await createAlbum(tracker, albumTitle, albumPrice);

        const album = await tracker.albums(0);

        // here we don't need await and () because it is a property
        expect(album.title).to.eq(albumTitle);
        expect(album.price).to.eq(albumPrice);
        expect(album.state).to.eq(0);
        expect(await tracker.currentIndex()).to.eq(1);

        const expectedAlbumAddr = await precomputeAddress(tracker);

        expect(receiptTx?.logs[0].topics[1]).to.eq(
            // to make the addresses we compare the same size
            ethers.zeroPadValue(expectedAlbumAddr, 32)
        );

        // using events
        // when checking events always use await
        await expect(receiptTx).to.emit(tracker, "AlbumStateChanged").withArgs(
            expectedAlbumAddr, 0, 0, albumTitle
        )
    });

    // test: buying album
    it("allows to buy albums", async function() {
        const { tracker, buyer } = await loadFixture(deploy);

        // we need recreate the album because the blockhain clears itself
        const albumTitle = "Enchantment of the Ring";
        const albumPrice = ethers.parseEther("0.00005")

        await createAlbum(tracker, albumTitle, albumPrice);

        const expectedAlbumAddr = await precomputeAddress(tracker);

        const album = Album__factory.connect(expectedAlbumAddr, buyer);

        const buyTxData = {
            to: expectedAlbumAddr,
            value: albumPrice,
        };

        const buyTx = await buyer.sendTransaction(buyTxData);
        await buyTx.wait();

        expect(await album.purchased()).to.be.true;
        expect((await tracker.albums(0)).state).to.eq(1);

        // here we also use await because the balance changes
        await expect(buyTx).to.changeEtherBalances(
            [buyer, tracker], [-albumPrice, albumPrice]
        )

        //checking errors (require)
        await expect(
            // here is no await because we want test to crash only if error occurs
            buyer.sendTransaction(buyTxData)
        ).to.be.revertedWith("This album is already purchased!");
    });

    // test: delivering album
    it("allows owner to trigger delivery", async function() {
        const { tracker, buyer, owner } = await loadFixture(deploy);
    
        // create an album
        const albumTitle = "Enchantment of the Ring";
        const albumPrice = ethers.parseEther("0.00005");
    
        await createAlbum(tracker, albumTitle, albumPrice);
    
        const expectedAlbumAddr = await precomputeAddress(tracker);
        const album = Album__factory.connect(expectedAlbumAddr, buyer);
    
        // buy the album
        const buyTxData = {
            to: expectedAlbumAddr,
            value: albumPrice,
        };
        const buyTx = await buyer.sendTransaction(buyTxData);
        await buyTx.wait();
    
        // ensure the album was purchased
        expect(await album.purchased()).to.be.true;
        expect((await tracker.albums(0)).state).to.eq(1); 
    
        // trigger delivery as owner
        const deliveryTx = await tracker.connect(owner).triggerDelivery(0);
        await deliveryTx.wait();
    
        // ensure the state is updated to "Delivered"
        expect((await tracker.albums(0)).state).to.eq(2); 
    
        // check the event was emitted correctly
        await expect(deliveryTx).to.emit(tracker, "AlbumStateChanged").withArgs(
            expectedAlbumAddr, 0, 2, albumTitle
        );

        // test reverts for non-owner attempting to trigger delivery AFTER delivery is successful
        await expect(
            tracker.connect(buyer).triggerDelivery(0)
        ).to.be.revertedWithCustomError(tracker, "OwnableUnauthorizedAccount").withArgs(buyer.address);
    });

    // helpers

    async function precomputeAddress(sc: BaseContract, nonce = 1): Promise<string> {
        return ethers.getCreateAddress({
            from: await sc.getAddress(),
            nonce
        });
    }

    async function createAlbum(tracker: AlbumTracker, title: string, price: bigint): Promise<ContractTransactionReceipt | null> {
        const createAlbumTx = await tracker.createAlbum(price, title);

        return await createAlbumTx.wait();
    }
});