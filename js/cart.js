// ============================================================
// cart.js — Cart & Wishlist Module
// ============================================================
const Cart = (() => {
  let _items=[]; let _wish=[]; let _unsub=null; let _onChange=null;

  function init(cb) { _onChange=cb; }

  function listen(uid) {
    if(_unsub) _unsub();
    _unsub = db.collection('carts').doc(uid).collection('items')
      .onSnapshot(snap => { _items=snap.docs.map(d=>({docId:d.id,...d.data()})); _onChange&&_onChange(_items); _updateBadge(); }, e=>console.error(e));
  }

  function stop() { if(_unsub){_unsub();_unsub=null;} _items=[]; _updateBadge(); }

  async function addItem(uid, product, size) {
    const weight = Number(product.weight) || 1;
    const pricePerGram = Number(product.price) || 0;
    const mcVal = Number(product.makingCharges) || 0;
    const mcType = product.mcType || 'percent';
    const discountVal = Number(product.discount) || 0;
    const discountType = product.discountType || 'percent';
    const gst = Number(product.gst) || 0;

    const base = pricePerGram * weight;
    const mcPerGram = mcType === 'amount' ? mcVal : (pricePerGram * mcVal / 100);
    const makingAmount = mcPerGram * weight;
    const subtotal = base + makingAmount;

    const discountAmt = discountType === 'amount' ? discountVal : (subtotal * discountVal / 100);
    const taxableAmount = Math.max(0, subtotal - discountAmt);
    const gstAmount = taxableAmount * gst / 100;
    const rawTotal = taxableAmount + gstAmount;
    const totalPrice = Math.round(rawTotal);
    const roundOff = Math.round((totalPrice - rawTotal) * 100) / 100;
    const mcLabel = mcType === 'amount' ? `₹${mcVal}/g` : `${mcVal}%`;

    const ref = db.collection('carts').doc(uid).collection('items').doc(product.id);
    const snap = await ref.get();
    if(snap.exists) { await ref.update({quantity:firebase.firestore.FieldValue.increment(1)}); }
    else { await ref.set({
      productId:product.id,
      name:product.name,
      price:totalPrice,
      basePrice:base,
      mcType:mcType,
      makingChargesRate:mcVal,
      makingChargesPct:mcType === 'amount' ? null : mcVal,
      makingCharges:makingAmount,
      makingLabel:mcLabel,
      discount:discountAmt,
      discountRate:discountVal,
      discountType:discountType,
      gst:gst,
      gstAmt:gstAmount,
      roundOff:roundOff,
      weight:product.weight||0,
      purity:product.purity||'',
      category:product.category,
      imageUrl:product.imageUrl,
      selectedSize:size||null,
      quantity:1,
      addedAt:firebase.firestore.FieldValue.serverTimestamp()
    }); }
  }

  async function updateQty(uid, docId, delta) {
    const item=_items.find(i=>i.docId===docId);
    if(!item) return;
    const nq=(item.quantity||1)+delta;
    if(nq<=0) await removeItem(uid,docId);
    else await db.collection('carts').doc(uid).collection('items').doc(docId).update({quantity:nq});
  }

  async function removeItem(uid, docId) { await db.collection('carts').doc(uid).collection('items').doc(docId).delete(); }

  async function clearCart(uid) {
    const snap = await db.collection('carts').doc(uid).collection('items').get();
    const b=db.batch(); snap.docs.forEach(d=>b.delete(d.ref)); await b.commit();
  }

  function getItems()  { return _items; }
  function getCount()  { return _items.reduce((s,i)=>s+(i.quantity||1),0); }
  function getTotal()  { return _items.reduce((s,i)=>s+(i.price*(i.quantity||1)),0); }

  function _updateBadge() {
    const c=getCount();
    document.querySelectorAll('.cart-badge-count').forEach(el=>{ el.textContent=c; el.style.display=c>0?'flex':'none'; });
  }

  // Wishlist
  function loadWish(uid) {
    _wish = JSON.parse(localStorage.getItem('lx_wish')||'[]');
    if(uid) { db.collection('wishlists').doc(uid).collection('items').get().then(s=>{ const ids=s.docs.map(d=>d.id); _wish=Array.from(new Set([..._wish,...ids])); localStorage.setItem('lx_wish',JSON.stringify(_wish)); _updateWishBadge(); }); }
    _updateWishBadge(); return _wish;
  }

  async function toggleWish(uid, product) {
    const id=product.id; const had=_wish.includes(id);
    if(had) { _wish=_wish.filter(x=>x!==id); if(uid) await db.collection('wishlists').doc(uid).collection('items').doc(id).delete(); }
    else { _wish.push(id); if(uid) await db.collection('wishlists').doc(uid).collection('items').doc(id).set({productId:product.id,name:product.name,price:product.price,category:product.category,imageUrl:product.imageUrl,purity:product.purity||'',addedAt:firebase.firestore.FieldValue.serverTimestamp()}); }
    localStorage.setItem('lx_wish',JSON.stringify(_wish)); _updateWishBadge(); return !had;
  }

  function isWished(id) { return _wish.includes(id); }

  async function getWishItems(uid) {
    if(!uid) return [];
    const s=await db.collection('wishlists').doc(uid).collection('items').get();
    return s.docs.map(d=>d.data());
  }

  async function removeWish(uid, productId) {
    _wish=_wish.filter(x=>x!==productId); localStorage.setItem('lx_wish',JSON.stringify(_wish)); _updateWishBadge();
    if(uid) await db.collection('wishlists').doc(uid).collection('items').doc(productId).delete();
  }

  function _updateWishBadge() {
    document.querySelectorAll('.wish-badge-count').forEach(el=>{ el.textContent=_wish.length; el.style.display=_wish.length>0?'flex':'none'; });
  }

  return { init,listen,stop,addItem,updateQty,removeItem,clearCart,getItems,getCount,getTotal,loadWish,toggleWish,isWished,getWishItems,removeWish };
})();
window.Cart = Cart;



