'use strict';

module.exports = function (Groupprice) {


    // update groupprice
    Groupprice.editgrouppricing = async (data) => {
        try {
            // find already exist in groupprice table or not
            var groupprice = await Groupprice.findOne({
                where: {
                    groupId: data.groupId,
                    productId: data.productId,
                    masterdetailId: data.masterdetailId
                }
            });

            // if groupprice already exist, update newprice
            if (groupprice) {
                await Groupprice.updateAll({
                    id: groupprice.id,
                    masterdetailId: data.masterdetailId
                }, {
                    newprice: data.newprice,
                    minimumorderquantity: data.minimumorderquantity
                });

            } else { // create new entry

                await Groupprice.create({
                    groupId: data.groupId,
                    productId: data.productId,
                    newprice: data.newprice,
                    minimumorderquantity: data.minimumorderquantity,
                    masterdetailId: data.masterdetailId
                });
            }

        } catch (error) {
            throw error;
        }

    };


    Groupprice.remoteMethod('editgrouppricing', {
        accepts: [{
            arg: 'data',
            type: 'object',
            http: {
                source: 'body'
            }
        }],
        returns: {
            arg: 'result',
            type: 'Object',
            root: true
        },
        http: {
            path: '/editgrouppricing',
            verb: 'post'
        }
    });

};
