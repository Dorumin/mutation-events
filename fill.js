(function() {
    const baseEventProps = {
        attrChange: 0,
        attrName: '',
        prevValue: '',
        newValue: '',
        relatedNode: null
    };

    const dispatch = (target, type, extra = {}) => {
        const event = new Event(type, { bubbles: true, cancelable: false });
        Object.assign(event, baseEventProps, extra);
        target.dispatchEvent(event);
    };

    const patch = (proto, method, handler) => {
        const original = proto[method];
        proto[method] = function (...args) {
            return handler(this, original, ...args);
        };
    };

    const patchSetter = (proto, property, handler) => {
        const descriptor = Object.getOwnPropertyDescriptor(proto, property);
        Object.defineProperty(proto, property, {
            set(value) {
                handler(this, descriptor.set, value);
            },
            get: descriptor.get,
            configurable: true,
            enumerable: descriptor.enumerable
        });
    };

    const isSupported = () => {
        // Mutation Events support is patchy as fuck, so a proper polyfill
        // would probably need to test all the different events
        // and patch accordingly
        const div = document.createElement('div');
        let supported = false;

        div.addEventListener('DOMNodeInserted', () => supported = true);
        const text = document.createTextNode('yep');
        div.appendChild(text);

        return supported;
    };

    if (isSupported()) return;

    // All events will behave as *IntoDocument variants,
    // no document-level dispatching of events because that's annoying

    patch(Element.prototype, 'appendChild', (self, original, child) => {
        const result = original.call(self, child);
        dispatch(child, 'DOMNodeInserted', { relatedNode: self});
        dispatch(self, 'DOMSubtreeModified');
        return result;
    });

    patch(Element.prototype, 'append', (self, original, ...nodes) => {
        // DOMNodeInserted and DOMSubtreeModified are fired for each node
        for (const child of nodes) {
            const node = typeof child === 'string'
                ? document.createTextNode(child)
                : child;

            // Our patched method does the dispatching work
            self.appendChild(node);
        }
    });

    patch(Element.prototype, 'remove', (self, original) => {
        const parent = self.parentNode;
        // Fire it first to bubble up, slightly out of spec...?
        if (parent) dispatch(self, 'DOMNodeRemoved', { relatedNode: parent});
        const result = original.call(self);
        if (parent) dispatch(parent, 'DOMSubtreeModified');
        return result;
    });

    patch(Element.prototype, 'removeChild', (self, original, child) => {
        // Fire before remove
        dispatch(child, 'DOMNodeRemoved', { relatedNode: self });
        const result = original.call(self, child);
        dispatch(self, 'DOMSubtreeModified');
        return result;
    });

    patch(Element.prototype, 'replaceChild', (self, original, newChild, oldChild) => {
        // Fire before replace
        dispatch(oldChild, 'DOMNodeRemoved', { relatedNode: self });
        const result = original.call(self, newChild, oldChild);
        dispatch(newChild, 'DOMNodeInserted', { relatedNode: self });
        dispatch(self, 'DOMSubtreeModified');
        return result;
    });

    patch(Element.prototype, 'insertBefore', (self, original, newChild, refChild) => {
        const result = original.call(self, newChild, refChild);
        dispatch(newChild, 'DOMNodeInserted', { relatedNode: self });
        dispatch(self, 'DOMSubtreeModified');
        return result;
    });

    patchSetter(Element.prototype, 'innerHTML', (self, original, value) => {
        // Setting innerHTML only fires DOMNodeRemoved for direct child nodes
        Array.from(self.childNodes).forEach(node => dispatch(node, 'DOMNodeRemoved', { relatedNode: 'self' }));

        original.call(self, value);

        // Same thing for Inserted
        Array.from(self.childNodes).forEach(node => dispatch(node, 'DOMNodeInserted', { relatedNode: 'self' }));

        dispatch(self, 'DOMSubtreeModified');
    });

    patchSetter(Node.prototype, 'textContent', (self, original, value) => {
        Array.from(self.childNodes).forEach(node => dispatch(node, 'DOMNodeRemoved', { relatedNode: 'self' }));

        const prevText = self.textContent;

        original.call(self, value);

        if (self instanceof Comment || self instanceof Text || self instanceof ProcessingInstruction) {
            dispatch(self, 'DOMCharacterDataModified', { prevValue: prevText, newValue: value });
        }

        Array.from(self.childNodes).forEach(node => dispatch(node, 'DOMNodeInserted', { relatedNode: 'self' }));

        dispatch(self, 'DOMSubtreeModified');
    });

    patch(Element.prototype, 'setAttribute', (self, original, name, value) => {
        const prevAttr = self.getAttribute(name);
        const result = original.call(self, name, value);
        let change;
        if (prevAttr === null) {
            change = 2;
        } else if (value === null) {
            change = 3;
        } else {
            change = 1;
        }

        // Gross gross gross NamedNode API
        const node = self.attributes[name];

        dispatch(self, 'DOMAttrModified', { relatedNode: node, attrName: name, attrChange: change, prevValue: prevAttr, newValue: value });
        dispatch(self, 'DOMSubtreeModified');
        return result;
    });

    patch(Element.prototype, 'setAttributeNS', (self, original, ns, name, value) => {
        const prevAttr = self.getAttribute(name);
        const result = original.call(self, ns, name, value);
        let change;
        if (prevAttr === null) {
            change = 2;
        } else if (value === null) {
            change = 3;
        } else {
            change = 1;
        }

        const node = self.attributes[name];

        dispatch(self, 'DOMAttrModified', { relatedNode: node, attrName: name, attrChange: change, prevValue: prevAttr, newValue: value });
        dispatch(self, 'DOMSubtreeModified');
        return result;
    });

    patch(Element.prototype, 'removeAttribute', (self, original, name, value) => {
        const prevAttr = self.getAttribute(name);
        const node = self.attributes[name];
        const result = original.call(self, name, value);

        dispatch(self, 'DOMAttrModified', { relatedNode: node, attrName: name, attrChange: 3, prevValue: prevAttr, newValue: '' });
        dispatch(self, 'DOMSubtreeModified');
        return result;
    });


    [
        ['id', 'id'],
        ['className', 'class'],
        ['value', 'value'],
        ['checked', 'checked'],
        ['disabled', 'disabled']
    ].forEach(([prop, attr]) => {
        patchSetter(Element.prototype, prop, (self, original, value) => {
            const prevValue = self.getAttribute(attr);
            original.call(self, value);
            let change;
            if (prevValue === null) {
                change = 2;
            } else if (value === null) {
                change = 3;
            } else {
                change = 1;
            }

            const node = self.attributes[attr];

            dispatch(self, 'DOMAttrModified', { relatedNode: node, attrName: attr, attrChange: change, prevValue, newValue: value });
            dispatch(self, 'DOMSubtreeModified');
        });
    });
})();
