/**
 * @typedef {Object} MutationEventProps
 * @property {'DOMNodeInserted' | 'DOMNodeRemoved' | 'DOMSubtreeModified' | 'DOMAttrModified' | 'DOMCharacterDataModified'} type
 * @property {Node} relatedNode - The node related to the mutation (e.g., parent node for removal).
 * @property {string} prevValue - The previous value of an attribute or character data before mutation.
 * @property {string} newValue - The new value of an attribute or character data after mutation.
 * @property {string} attrName - The name of the changed attribute for DOMAttrModified, or empty.
 * @property {number} attrChange - One of MODIFICATION (1), ADDITION (2), or REMOVAL (3), or N/A (0)
 */

/**
 * @typedef {Event & MutationEventProps} MutationEvent
 */

window.addEventListener("load", () => {
    const puppet = document.querySelector('.puppet');
    const resultsDiv = document.querySelector('.results');

    if (!puppet || !resultsDiv) return;

    /** @type {MutationEvent[]} */
    let log = [];
    let expected = [];

    /** @type {{ description: string, logs: MutationEvent[], expected: MutationEventProps[] }[]} */
    const results = [];

    let inTest = false;

    /**
     * @param {Node} node
     */
    function stringifyNode(node) {
        let s = (node.nodeName || '#null').toString().toLowerCase();

        if (node.id) {
            s += '#' + node.id;
        } else if (node.className) {
            s += node.className.split(/\s+/).map(c => '.' + c.toLowerCase()).join('');
        }

        return s;
    }

    /**
     * @param {MutationEvent} event
     */
    function stringifyProps(event) {
        let props = '';

        if (event.target) {
            props += `target: ${stringifyNode(event.target)}, `;
        }

        if (event.relatedNode) {
            props += `node: ${stringifyNode(event.relatedNode)}, `;
        }

        if (event.attrName) {
            props += `attr: ${event.attrName}, `;
        }

        if (event.attrChange) {
            props += `change: ${event.attrChange}, `;
        }

        if (event.prevValue) {
            props += `prev: ${event.prevValue}, `;
        }

        if (event.newValue) {
            props += `new: ${event.newValue}, `;
        }

        props = props.slice(0, -2);

        return props;
    }

    function stringifyEvent(event) {
        const props = stringifyProps(event);
        return `${event.type} { ${props} }`;
    }

    /**
     * @param {MutationEvent} event
     */
    function logEvent(event) {
        log.push(event);

        if (inTest) {
            const log = stringifyEvent(event);

            console.log(log, event);
        }
    }

    /**
     *
     * @param {string} description
     * @param {(puppet: HTMLElement) => void} run
     */
    function it(description, run) {
        inTest = true;
        run(puppet);
        inTest = false;

        results.push({
            description,
            logs: log,
            expected
        });

        expected = [];
        log = [];
        puppet.innerHTML = '';
        log = [];
    }

    /**
     * @param {MutationEventProps[]} conditions
     */
    function expect(conditions) {
        expected.push(...conditions);
    }

    function renderResults() {
        for (const result of results) {
            const resultDiv = document.createElement('div');
            const resultOutcome = document.createElement('div');
            const resultLists = document.createElement('div');
            const resultResults = document.createElement('ol');
            const resultExpected = document.createElement('ol');
            resultDiv.className = 'result';
            resultOutcome.className = 'result-outcome';
            resultLists.className = 'result-lists';
            resultResults.className = 'result-results';
            resultExpected.className = 'result-expected';

            resultOutcome.textContent = result.description;

            for (const log of result.logs) {
                const resultLog = document.createElement('li');
                resultLog.textContent = stringifyEvent(log);
                resultResults.append(resultLog);
            }

            for (const expected of result.expected) {
                const resultLog = document.createElement('li');
                resultLog.textContent = stringifyEvent(expected);
                resultExpected.append(resultLog);
            }

            resultLists.append(resultResults, resultExpected);
            resultDiv.append(resultOutcome, resultLists);

            resultsDiv.append(resultDiv);
        }
    }

    puppet.addEventListener("DOMNodeInserted", logEvent);
    puppet.addEventListener("DOMNodeRemoved", logEvent);
    puppet.addEventListener("DOMSubtreeModified", logEvent);
    puppet.addEventListener("DOMAttrModified", logEvent);
    puppet.addEventListener("DOMCharacterDataModified", logEvent);

    it('inserts', (puppet) => {
        const testDiv = document.createElement('div');
        testDiv.className = 'inserted';
        testDiv.textContent = 'Hello';
        const testSpan = document.createElement('span');
        testSpan.className = 'span';
        puppet.append(testDiv, testSpan, 'text');

        expect([
            {
                type: 'DOMNodeInserted'
            },
            {
                type: 'DOMSubtreeModified'
            },
            {
                type: 'DOMNodeInserted'
            },
            {
                type: 'DOMSubtreeModified'
            },
            {
                type: 'DOMNodeInserted',
                target: { nodeName: '#text' }
            },
            {
                type: 'DOMSubtreeModified'
            },
        ]);
    });

    it('removes', (puppet) => {
        const testDiv = document.createElement('div');
        testDiv.className = 'inserted';
        testDiv.textContent = 'Hello';
        puppet.append(testDiv);
        testDiv.remove();
        puppet.appendChild(testDiv);
        puppet.removeChild(testDiv);

        expect([
            {
                type: 'DOMNodeInserted'
            },
            {
                type: 'DOMSubtreeModified'
            },
            {
                type: 'DOMNodeRemoved'
            },
            {
                type: 'DOMSubtreeModified'
            },
            {
                type: 'DOMNodeInserted'
            },
            {
                type: 'DOMSubtreeModified'
            },
            {
                type: 'DOMNodeRemoved'
            },
            {
                type: 'DOMSubtreeModified'
            },
        ]);
    });

    it('attrs', (puppet) => {
        const testDiv = document.createElement('div');
        testDiv.className = 'inserted';
        testDiv.textContent = 'Hello';
        testDiv.setAttribute('hello-world', '1');
        puppet.append(testDiv);

        testDiv.className = 'inserted modified';
        testDiv.setAttribute('hello-world', '2');
        testDiv.setAttributeNS('http://google.com', 'my', 'beloved');
        testDiv.removeAttribute('hello-world');

        expect([
            {
                type: 'DOMNodeInserted'
            },
            {
                type: 'DOMSubtreeModified'
            },
            {
                type: 'DOMAttrModified'
            },
            {
                type: 'DOMSubtreeModified'
            },
            {
                type: 'DOMAttrModified'
            },
            {
                type: 'DOMSubtreeModified'
            },
            {
                type: 'DOMAttrModified'
            },
            {
                type: 'DOMSubtreeModified'
            },
            {
                type: 'DOMAttrModified'
            },
            {
                type: 'DOMSubtreeModified'
            },
        ]);
    });

    it('cdata', (puppet) => {
        const testDiv = document.createElement('div');
        const testText = document.createTextNode('Hello');
        const testComment = document.createComment('Top');
        // const testCdata = document.createCDATASection('xml sucks');
        const testInstruction = document.createProcessingInstruction('body', 'abc');
        testDiv.append(testText, testComment, testInstruction);
        puppet.append(testDiv);

        testText.textContent = 'Goodbye';
        testComment.textContent = 'secret';
        testInstruction.textContent = 'idk'

        expect([
            {
                type: 'DOMNodeInserted'
            },
            {
                type: 'DOMSubtreeModified'
            },
            {
                type: 'DOMCharacterDataModified',
                target: { nodeName: '#text' },
                prevValue: 'Hello',
                newValue: 'Goodbye'
            },
            {
                type: 'DOMSubtreeModified',
                target: { nodeName: '#text' }
            },
            {
                type: 'DOMCharacterDataModified',
                target: { nodeName: '#comment' },
                prevValue: 'Top',
                newValue: 'secret'
            },
            {
                type: 'DOMSubtreeModified',
                target: { nodeName: '#comment' }
            },
            {
                type: 'DOMCharacterDataModified',
                target: { nodeName: 'body' },
                prevValue: 'abc',
                newValue: 'idk'
            },
            {
                type: 'DOMSubtreeModified',
                target: { nodeName: 'body' }
            },
        ]);
    });

    it('inner', (puppet) => {
        const container = document.createElement('div');
        puppet.append(container);

        container.innerHTML = 'sample';
        container.innerHTML = '';
        container.innerHTML = '<p><span></span></p>';
        container.innerHTML = '<p><s></s></p>';
        container.textContent = 'OVERRIDE';

        expect([
            {
                type: 'DOMNodeInserted'
            },
            {
                type: 'DOMSubtreeModified'
            },
            {
                type: 'DOMNodeInserted'
            },
            {
                type: 'DOMSubtreeModified'
            },
            {
                type: 'DOMNodeRemoved'
            },
            {
                type: 'DOMSubtreeModified'
            },
            {
                type: 'DOMNodeInserted'
            },
            {
                type: 'DOMSubtreeModified'
            },
            // Remove->Insertion done in sequence, no subtree in-between
            {
                type: 'DOMNodeRemoved'
            },
            {
                type: 'DOMNodeInserted'
            },
            {
                type: 'DOMSubtreeModified'
            },
            {
                type: 'DOMNodeRemoved'
            },
            {
                type: 'DOMNodeInserted'
            },
            {
                type: 'DOMSubtreeModified'
            },
        ]);
    });

    renderResults();
});
