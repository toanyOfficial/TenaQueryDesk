-- Synthetic fixture only. Never run against production.
CREATE TABLE customers (id BIGINT PRIMARY KEY, customer_key VARCHAR(32) NOT NULL UNIQUE, name VARCHAR(80) NOT NULL, email VARCHAR(160) NULL, phone VARCHAR(20) NULL);
CREATE TABLE orders (id BIGINT PRIMARY KEY, customer_id BIGINT NOT NULL, status ENUM('pending','completed','cancelled') NOT NULL, ordered_at DATETIME NOT NULL, total_amount DECIMAL(12,2) NOT NULL, INDEX idx_orders_date(ordered_at), CONSTRAINT fk_orders_customer FOREIGN KEY(customer_id) REFERENCES customers(id));
CREATE TABLE order_items (id BIGINT PRIMARY KEY, order_id BIGINT NOT NULL, product_code VARCHAR(32) NOT NULL, quantity INT NOT NULL, unit_price DECIMAL(12,2) NOT NULL, CONSTRAINT fk_items_order FOREIGN KEY(order_id) REFERENCES orders(id));
CREATE TABLE payments (id BIGINT PRIMARY KEY, order_id BIGINT NOT NULL, payment_key VARCHAR(40) NOT NULL UNIQUE, paid_amount DECIMAL(12,2) NOT NULL, card_last4 CHAR(4) NULL, paid_at DATETIME NULL);
CREATE TABLE cancellations (id BIGINT PRIMARY KEY, order_id BIGINT NOT NULL, reason VARCHAR(200) NULL, cancelled_at DATETIME NOT NULL);
CREATE VIEW completed_order_summary AS SELECT DATE(ordered_at) order_date, COUNT(*) order_count, SUM(total_amount) amount FROM orders WHERE status='completed' GROUP BY DATE(ordered_at);
INSERT INTO customers VALUES (1,'C001','Fixture Alpha','alpha@example.invalid','010-0000-0001'),(2,'C002','Fixture Beta',NULL,'010-0000-0002'),(3,'C003','Fixture Alpha','duplicate@example.invalid',NULL);
INSERT INTO orders VALUES (101,1,'completed','2026-06-10 10:00:00',120.00),(102,1,'cancelled','2026-06-11 10:00:00',50.00),(103,2,'completed','2026-07-01 10:00:00',0.00),(104,2,'pending','2026-07-02 10:00:00',80.00),(105,3,'completed','2027-01-01 10:00:00',200.00);
INSERT INTO order_items VALUES (1,101,'SKU-A',2,60.00),(2,102,'SKU-B',1,50.00),(3,103,'SKU-C',1,0.00),(4,104,'SKU-D',2,40.00),(5,105,'SKU-E',1,200.00);
INSERT INTO payments VALUES (1,101,'PAY-101',120.00,'1111','2026-06-10 10:05:00'),(2,103,'PAY-103',0.00,NULL,'2026-07-01 10:05:00');
INSERT INTO cancellations VALUES (1,102,'fixture cancellation','2026-06-11 11:00:00');
