// استبدل دالة window.startCheckout بالكامل بهذا الكود داخل index.html

window.startCheckout = async () => {
    if (!auth.currentUser) {
        toggleCart(false);
        return handleAuth();
    }

    if (cart.length === 0) {
        return Toast.fire({ icon: 'info', title: 'سلة المشتريات فارغة' });
    }

    // نرسل فقط productId + qty للسيرفر — السعر يُحسب هناك من Firebase مباشرة
    // (لا نثق بالسعر المعروض بالمتصفح، حتى لا يستطيع أحد التلاعب به)
    const itemsPayload = cart.map(it => ({ productId: it.key, quantity: it.qty }));
    const discountCode = document.getElementById('discount-input')?.value?.trim() || null;

    toggleCart(false);
    Swal.fire({
        title: 'جاري تجهيز عملية الدفع...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    const uid = auth.currentUser.uid;

    try {
        // 1) طلب رابط الدفع الآمن من السيرفر (يتحقق من الأسعار بنفسه)
        const paymentRes = await fetch('/api/create-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: itemsPayload, discountCode })
        });

        const paymentData = await paymentRes.json();

        if (!paymentRes.ok || !paymentData.url) {
            Swal.close();
            return Swal.fire('تعذر إتمام الطلب', paymentData.error || 'حدث خطأ غير متوقع، حاول لاحقاً.', 'error');
        }

        // 2) تسجيل الطلب بـ Firebase بنفس المبلغ الحقيقي المُتحقق منه من السيرفر
        const orderData = {
            userId: uid,
            customerEmail: auth.currentUser.email,
            items: cart,
            total: paymentData.total,
            shopierOrderId: paymentData.orderId,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        await push(ref(db, `orders/${uid}`), orderData);

        cart = [];
        updateCartUI();
        Swal.close();

        // 3) التوجيه المباشر لصفحة دفع Shopier الخاصة بهذا الطلب بالذات
        window.location.href = paymentData.url;

    } catch (error) {
        Swal.close();
        Swal.fire('خطأ', 'تعذر الاتصال بسيرفر الدفع. حاول مرة أخرى.', 'error');
    }
};
