const parse = require('.')

describe('utf8 test', () => {
    test('russian lang', async () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <КоммерческаяИнформация xmlns="urn:1C.ru:commerceml_2" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ВерсияСхемы="2.07" ДатаФормирования="2016-04-23T13:02:14">
            <Каталог СодержитТолькоИзменения="false">
                <Ид>a9338328-b467-4669-bece-8050d53be19b</Ид>
                <ИдКлассификатора>a9338328-b467-4669-bece-8050d53be19b</ИдКлассификатора>
                <Наименование>Каталог товаров A9338328</Наименование>
            </Каталог>
        </КоммерческаяИнформация>`

        expect(await parse(xml)).toEqual([
            ['xmlDecl', { version: '1.0', encoding: 'UTF-8' }],
            [
                'startElement',
                'КоммерческаяИнформация',
                {
                    xmlns: 'urn:1C.ru:commerceml_2',
                    'xmlns:xs': 'http://www.w3.org/2001/XMLSchema',
                    'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                    ВерсияСхемы: '2.07',
                    ДатаФормирования: '2016-04-23T13:02:14',
                },
            ],
            ['startElement', 'Каталог', { СодержитТолькоИзменения: 'false' }],
            ['startElement', 'Ид', {}],
            ['text', 'a9338328-b467-4669-bece-8050d53be19b'],
            ['endElement', 'Ид'],
            ['startElement', 'ИдКлассификатора', {}],
            ['text', 'a9338328-b467-4669-bece-8050d53be19b'],
            ['endElement', 'ИдКлассификатора'],
            ['startElement', 'Наименование', {}],
            ['text', 'Каталог товаров A9338328'],
            ['endElement', 'Наименование'],
            ['endElement', 'Каталог'],
            ['endElement', 'КоммерческаяИнформация'],
        ])
    })

    test('cyrillic', async () => {
        const xml = '<hello>тест</hello>'
        expect(await parse(xml)).toEqual([
            ['startElement', 'hello', {}],
            ['text', 'тест'],
            ['endElement', 'hello'],
        ])
    })
})
