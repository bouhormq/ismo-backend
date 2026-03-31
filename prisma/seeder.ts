import { CompanyPotential, PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import * as argon from 'argon2';

const prisma = new PrismaClient();

const CompanyPotentialOrder = {
  AVAILABLE_EQUIPMENT: 0,
  NEUTRAL: 1,
  MATERIAL_REQUEST: 2,
  PROJECT_STUDY: 3,
  NEGOTIATION: 4,
  CONCLUSION: 5,
};

async function main() {
  // Use existing user or create one
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: 'Najib',
        username: 'najib',
        password: await argon.hash('test123'),
      },
    });
  }
  console.log(`Using user: ${user.name} (id: ${user.id})`);

  await createCompanies(user.id);
  await createArticles();
  await createContacts();
}

async function createCompanies(userId: number) {
  const companyPotentialValues = Object.values(CompanyPotential);

  for (let i = 0; i < 10; i++) {
    const potential =
      companyPotentialValues[
        Math.floor(Math.random() * companyPotentialValues.length)
      ];
    const potentialOrder = CompanyPotentialOrder[potential];

    const company = await prisma.company.create({
      data: {
        companyName: faker.company.name(),
        address: faker.location.streetAddress(),
        phoneNumber: faker.phone.number({ style: 'international' }),
        compl: faker.location.direction(),
        email: faker.internet.email(),
        zipCode: faker.location.zipCode(),
        city: faker.location.city(),
        website: faker.internet.url(),
        country: faker.location.country(),
        siret: String(
          faker.number.int({ min: 10000000000000, max: 99999999999999 }),
        ),
        vatNumber: faker.finance.accountNumber(),
        companyType: { create: { name: faker.company.buzzAdjective() } },
        code: String(faker.number.int({ min: 1000, max: 9999 })),
        followedBy: { connect: { id: userId } },
        companyPotential: potential,
        companyPotentialOrder: potentialOrder,
        contactOrigin: { create: { name: faker.company.catchPhrase() } },
        industries: {
          create: [
            { name: faker.commerce.department() },
            { name: faker.commerce.department() },
          ],
        },
        categories: {
          create: [
            { name: faker.commerce.productAdjective() },
            { name: faker.commerce.productAdjective() },
          ],
        },
        sections: {
          create: [
            { name: faker.commerce.productMaterial() },
            { name: faker.commerce.productMaterial() },
          ],
        },
      },
    });

    console.log(`Company ${i + 1} created: ${company.companyName}`);
  }
}

async function createArticles() {
  const companies = await prisma.company.findMany({ take: 10 });

  for (let i = 0; i < companies.length; i++) {
    const article = await prisma.article.create({
      data: {
        title: faker.commerce.productName(),
        reference: `PROD-${String(i + 1).padStart(3, '0')}`,
        company: { connect: { id: companies[i].id } },
        category: { create: { name: faker.commerce.productAdjective() } },
        section: { create: { name: faker.commerce.productMaterial() } },
        industry: { create: { name: faker.commerce.department() } },
      },
    });

    console.log(`Article ${i + 1} created: ${article.title}`);
  }
}

async function createContacts() {
  const companies = await prisma.company.findMany({ take: 10 });
  const genders: ('MALE' | 'FEMALE')[] = ['MALE', 'FEMALE'];
  const emails = ['bouhormq@gmail.com', 'sbouhorma@gmail.com'];

  for (const company of companies) {
    const contactCount = faker.number.int({ min: 1, max: 3 });
    for (let j = 0; j < contactCount; j++) {
      const gender = genders[Math.floor(Math.random() * genders.length)];
      const firstName = faker.person.firstName(
        gender === 'MALE' ? 'male' : 'female',
      );
      const lastName = faker.person.lastName();

      const contact = await prisma.contact.create({
        data: {
          firstName,
          lastName,
          email: emails[j % emails.length],
          phoneNumber: faker.phone.number({ style: 'international' }),
          gender,
          hasWhatsapp: faker.datatype.boolean(),
          functionality: faker.person.jobTitle(),
          Company: { connect: { id: company.id } },
        },
      });

      console.log(
        `Contact created: ${contact.firstName} ${contact.lastName} (${contact.email}) for ${company.companyName}`,
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
